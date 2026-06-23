#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTW Concierge — Pipeline de tratamento da base e geração de artefatos.

Lê a base bruta (ttw_case_candidatos.csv), trata o ruído documentadamente,
deriva features de negócio (duração, multi-destino, perfil/temas) e exporta:
  - data/ttw_clean.csv          : base limpa e auditável
  - lib/data/activities.json    : corpus de atividades (retrieval do Concierge)
  - lib/data/destinations.json  : perfil de cada destino (temas, sazonalidade)
  - lib/data/vocab.json         : vocabulário + IDF para busca semântica local
  - public/data/insights.json   : insights agregados (dashboard)

Decisões de tratamento são registradas em data/relatorio_qualidade.json.
"""
import os, re, json, unicodedata, math
from collections import Counter, defaultdict
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.environ.get("TTW_RAW_CSV", os.path.join(ROOT, "..", "ttw_case_candidatos.csv"))
if not os.path.exists(RAW):
    RAW = os.path.join(ROOT, "data", "ttw_case_candidatos.csv")

def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

# ---------------------------------------------------------------------------
# 1. Catalogo canonico de destinos (os ~20 destinos reais da base)
# ---------------------------------------------------------------------------
CANONICAL = {
    "orlando":"Orlando","londres":"Londres","miami":"Miami","buenos aires":"Buenos Aires",
    "istambul":"Istambul","dubai":"Dubai","atenas":"Atenas","veneza":"Veneza","roma":"Roma",
    "nova york":"Nova York","tokyo":"Tokyo","toquio":"Tokyo","amsterdam":"Amsterdam","amsterda":"Amsterdam",
    "florenca":"Florença","madrid":"Madri","madri":"Madri","marrakech":"Marrakech","cairo":"Cairo",
    "milao":"Milão","paris":"Paris","lisboa":"Lisboa","barcelona":"Barcelona",
}
COUNTRY = {
    "Orlando":"EUA","Miami":"EUA","Nova York":"EUA","Londres":"Reino Unido","Paris":"França",
    "Buenos Aires":"Argentina","Istambul":"Turquia","Dubai":"Emirados Árabes","Atenas":"Grécia",
    "Veneza":"Itália","Roma":"Itália","Florença":"Itália","Milão":"Itália","Tokyo":"Japão",
    "Amsterdam":"Holanda","Madri":"Espanha","Barcelona":"Espanha","Marrakech":"Marrocos",
    "Cairo":"Egito","Lisboa":"Portugal",
}
ORIGIN = {"sao paulo"}  # cidade de origem nas viagens, nao e destino

def resolve_city(raw):
    """Retorna (cidade_canonica|None, status)."""
    if not isinstance(raw, str) or not raw.strip():
        return None, "vazio"
    s = strip_accents(raw.strip().lower())
    # NB: linhas com city == "01 Ingresso Disney World - Data Fixa" são ruído de
    # bilheteria — a narrativa real é de OUTRAS cidades (Londres, Cairo, Madri…),
    # não de Orlando. Por isso NÃO mapeamos para Orlando; ficam como desconhecido
    # (destino verdadeiro só existe no texto livre, de forma ambígua).
    s = re.sub(r"^\d+[ºo]?\s*dia\s*[-–]?\s*", "", s)      # "2 Dia - Madrid"
    s = re.sub(r"^check[- ]?in\s+(em\s+)?", "", s)         # "Check-in Lisboa"
    s = re.sub(r"^chegada e check[- ]?in\s+(em\s+)?", "", s)
    s = re.sub(r"^chegada\s+(em\s+)?", "", s)
    s = re.sub(r"\bingresso.*$", "", s)                    # "01 Ingresso Disney World..."
    s = re.sub(r"^\d+\s*", "", s).strip()
    parts = re.split(r"[/|]", s)
    if len(parts) > 1:
        cand = [p.strip() for p in parts if p.strip() and p.strip() not in ORIGIN]
        s = cand[0] if cand else parts[0].strip()
    s = s.strip()
    if s in {"em navegacao","navegacao"}: return None, "em_navegacao"
    if s in {"wedding day","free day","day off"}: return None, "marcador_operacional"
    if s in ORIGIN: return None, "origem_sao_paulo"
    if s in CANONICAL: return CANONICAL[s], ("limpo" if raw.strip()==CANONICAL.get(s) else "normalizado")
    for key, canon in CANONICAL.items():
        if key in s: return canon, "normalizado"
    return None, "desconhecido"

# ---------------------------------------------------------------------------
# 2. Taxonomia de perfis/temas de viagem (keywords PT, sem acento)
# ---------------------------------------------------------------------------
THEMES = {
    "Gastronomia":      ["jantar","almoco","restaurante","gastronom","degustac","vinho","queijo","prato","culinar","frutos do mar","cafe da manha","mercado gastron","bistro","tapas","trattoria"],
    "Arte & Museus":    ["museu","galeria","galleria","accademia","arte","exposic","pinacoteca","obras","escultura","picasso","van gogh","louvre","michelangelo","david de michelangelo","uffizi"],
    "História & Cultura":["histor","ruina","templo","igreja","catedral","palacio","castelo","forum","antig","monumento","mesquita","basilica","piramide","acropole","coliseu","medieval"],
    "Natureza & Paisagem":["parque","jardim","montanha","lago","rio","natureza","mirante","vista","deserto","safari","oasis","gruta","cascata"],
    # nota: "mar " removido — só capturava "frutos do mar" (gastronomia), inflando Praia & Mar.
    "Praia & Mar":      ["praia","barco","baia","marina","cruzeiro","navegac","iate","costa","ilha","litoral"],
    "Compras":          ["compras","boutique","loja","shopping","outlet","mercado"],
    "Vida Noturna":     ["vida noturna","balada","noite","bar ","pub","show","espetaculo","tango"],
    "Romance":          ["romantic","por do sol","casal","lua de mel","gondola","intimo"],
    "Aventura":         ["aventura","trilha","caminhada","excursao","esqui","mergulho","quadricicl","balao"],
    "Bem-estar":        ["spa","relax","descanso","dia livre","termas","hammam","massagem","piscina"],
    "Arquitetura":      ["arquitetura","contemporan","arranha-ceu","edific","design","moderno bairro"],
    "Parques Temáticos":["disney","universal","epcot","magic kingdom","parque tematico","hollywood studios","animal kingdom","seaworld"],
}

STOP = set(strip_accents(w) for w in """a o e de da do das dos para com por em no na nos nas um uma uns umas
que se ao aos as os sua seu suas seus pela pelo pelos pelas neste nesta deste desta este esta isso
recomendamos sugerimos manha tarde noite dia encerrar seguida seguido visita passeio para apos onde
mais muito tambem entre sobre ate como sao suas dos pela e a o de""".split())

def tokenize(text):
    t = strip_accents(text.lower())
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    return [w for w in t.split() if len(w) > 2 and w not in STOP]

def tag_themes(desc):
    if not isinstance(desc, str): return []
    d = strip_accents(desc.lower())
    found = []
    for theme, kws in THEMES.items():
        if any(k in d for k in kws):
            found.append(theme)
    return found

def clean_description(desc):
    if not isinstance(desc, str): return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", desc)).strip()

# ---------------------------------------------------------------------------
# 3. Carrega e trata
# ---------------------------------------------------------------------------
df = pd.read_csv(RAW)
df.columns = [c.strip().lstrip("﻿") for c in df.columns]
n0 = len(df)
df["date"] = pd.to_datetime(df["date"], errors="coerce")
res = df["city"].apply(resolve_city)
df["city_clean"] = res.apply(lambda x: x[0])
df["city_status"] = res.apply(lambda x: x[1])
df["has_description"] = df["description"].notna() & (df["description"].str.strip().str.len() > 0)
df["_description_clean"] = df["description"].apply(clean_description)
# tematiza sobre o texto já limpo (sem HTML), para não depender de marcação na narrativa
df["themes"] = df["_description_clean"].apply(tag_themes)
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.month
usable_mask = df["city_clean"].notna() & df["has_description"]

# ---------------------------------------------------------------------------
# 4. Relatorio de qualidade (auditavel)
# ---------------------------------------------------------------------------
quality = {
    "linhas_totais": n0,
    "viagens_unicas": int(df["trip_id"].nunique()),
    "descricoes_vazias": int((~df["has_description"]).sum()),
    "pct_descricoes_vazias": round(100*(~df["has_description"]).mean(),1),
    "city_status": {k:int(v) for k,v in df["city_status"].value_counts().items()},
    "cidades_brutas_distintas": int(df["city"].nunique()),
    "cidades_canonicas": int(df["city_clean"].nunique()),
    "linhas_com_destino_resolvido": int(df["city_clean"].notna().sum()),
    "linhas_utilizaveis": int(usable_mask.sum()),
    "pct_linhas_utilizaveis": round(100*usable_mask.mean(),1),
    "narrativas_distintas": int(df.loc[df["has_description"], "_description_clean"].nunique()),
    "descricoes_com_html": int(df["description"].fillna("").str.contains(r"<[^>]+>", regex=True).sum()),
    "periodo": {"min": str(df["date"].min().date()), "max": str(df["date"].max().date())},
}

# ---------------------------------------------------------------------------
# 5. TF-IDF compacto (fallback local de busca semantica)
# ---------------------------------------------------------------------------
docs = df["description"].fillna("").tolist()
tokenized = [tokenize(d) for d in docs]
dfreq = Counter()
for toks in tokenized:
    for w in set(toks):
        dfreq[w]+=1
N = len(tokenized)
vocab = {
    w:i for i,(w,c) in enumerate(sorted(dfreq.items(), key=lambda x:(-x[1], x[0])))
    if 5<=c<=0.6*N
}
idf = {w: math.log((1+N)/(1+dfreq[w]))+1 for w in vocab}

def vectorize(toks):
    tf = Counter(t for t in toks if t in vocab)
    if not tf: return {}
    vec = {vocab[w]: f*idf[w] for w,f in tf.items()}
    norm = math.sqrt(sum(v*v for v in vec.values())) or 1.0
    return {k: round(v/norm,4) for k,v in vec.items()}

df["_vec"] = [vectorize(t) for t in tokenized]

# ---------------------------------------------------------------------------
# 6. Exporta base limpa
# ---------------------------------------------------------------------------
os.makedirs(os.path.join(ROOT,"data"), exist_ok=True)
clean_cols = ["id","trip_id","date","city","city_clean","city_status","has_description","themes","description"]
out = df[clean_cols].copy()
out["date"] = out["date"].dt.strftime("%Y-%m-%d")
out["themes"] = out["themes"].apply(lambda x: "|".join(x))
out.to_csv(os.path.join(ROOT,"data","ttw_clean.csv"), index=False)

# ---------------------------------------------------------------------------
# 7. activities.json (corpus para retrieval)
# ---------------------------------------------------------------------------
valid = df[usable_mask].copy()
activities = []
for _, r in valid.iterrows():
    activities.append({
        "id": r["id"], "trip_id": r["trip_id"], "city": r["city_clean"],
        "country": COUNTRY.get(r["city_clean"],""), "month": int(r["month"]) if pd.notna(r["month"]) else None,
        "themes": r["themes"], "text": r["_description_clean"], "vec": r["_vec"],
    })

# ---------------------------------------------------------------------------
# 8. destinations.json (perfil por destino)
# ---------------------------------------------------------------------------
MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
destinations = []
for city, g in valid.groupby("city_clean"):
    theme_counts = Counter(t for ts in g["themes"] for t in ts)
    total = len(g)
    theme_scores = {t: round(theme_counts.get(t,0)/total,3) for t in THEMES}
    month_counts = Counter(int(m) for m in g["month"].dropna())
    seasonality = [month_counts.get(m,0) for m in range(1,13)]
    centroid = defaultdict(float)
    for v in g["_vec"]:
        for k,val in v.items(): centroid[int(k)]+=val
    if centroid:
        norm = math.sqrt(sum(x*x for x in centroid.values())) or 1.0
        centroid = {
            k: round(v/norm,4)
            for k,v in sorted(centroid.items(), key=lambda x:(-x[1], x[0]))[:60]
        }
    unique_samples = list(dict.fromkeys(g["_description_clean"].tolist()))
    destinations.append({
        "city": city, "country": COUNTRY.get(city,""), "activities": total,
        "trips": int(g["trip_id"].nunique()),
        "unique_narratives": len(unique_samples),
        "theme_scores": theme_scores,
        "top_themes": [t for t,_ in theme_counts.most_common(4)],
        "seasonality": seasonality,
        "peak_month": MONTHS_PT[max(range(12), key=lambda i: seasonality[i])] if total else None,
        "centroid": centroid,
        "samples": unique_samples[:6],
    })
destinations.sort(key=lambda d:-d["activities"])

# ---------------------------------------------------------------------------
# 9. insights.json (dashboard)
# ---------------------------------------------------------------------------
trip_sizes = df.groupby("trip_id").size()
month_all = Counter(int(m) for m in df["month"].dropna())
theme_global = Counter(t for ts in valid["themes"] for t in ts)
year_counts = Counter(int(y) for y in df["year"].dropna())

insights = {
    "kpis": {
        "atividades": n0,
        "viagens": int(df["trip_id"].nunique()),
        "destinos": int(df["city_clean"].nunique()),
        "anos": f'{df["date"].min().year}-{df["date"].max().year}',
        "cobertura_descricao": round(100*df["has_description"].mean(),1),
    },
    "quality": quality,
    "destinos_ranking": [{"city":d["city"],"country":d["country"],"activities":d["activities"]} for d in destinations],
    "sazonalidade_global": [month_all.get(m,0) for m in range(1,13)],
    "meses_label": MONTHS_PT,
    "temas_globais": [{"theme":t,"count":c} for t,c in theme_global.most_common()],
    "duracao": {
        "media_dias_amostra": round(float(trip_sizes.mean()),2),
        "distribuicao": {str(k):int(v) for k,v in trip_sizes.value_counts().sort_index().items()},
        "obs": "Amostra de 5.000 linhas: a maioria das viagens aparece com 1 dia amostrado; multi-dia e subamostrado.",
    },
    "por_ano": [{"ano":str(y),"count":year_counts.get(y,0)} for y in sorted(year_counts)],
    "sazonalidade_por_destino": [{"city":d["city"],"seasonality":d["seasonality"],"peak":d["peak_month"]} for d in destinations],
    "perfil_por_destino": [{"city":d["city"],"theme_scores":d["theme_scores"],"top_themes":d["top_themes"],"unique_narratives":d["unique_narratives"]} for d in destinations],
}

# ---------------------------------------------------------------------------
# 10. Grava
# ---------------------------------------------------------------------------
def dump(path, obj):
    with open(path,"w",encoding="utf-8") as f: json.dump(obj,f,ensure_ascii=False)
dump(os.path.join(ROOT,"lib","data","activities.json"), activities)
dump(os.path.join(ROOT,"lib","data","destinations.json"), destinations)
dump(os.path.join(ROOT,"lib","data","vocab.json"), {"vocab":vocab,"idf":{w:round(v,4) for w,v in idf.items()}})
dump(os.path.join(ROOT,"public","data","insights.json"), insights)
dump(os.path.join(ROOT,"data","relatorio_qualidade.json"), quality)

print(json.dumps(quality, ensure_ascii=False, indent=2))
print("activities:", len(activities), "destinations:", len(destinations), "vocab:", len(vocab))
