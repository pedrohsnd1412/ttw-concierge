#!/usr/bin/env python3
"""Recalcula e reconcilia as métricas publicadas a partir da base bruta."""

import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "ttw_case_candidatos.csv"
CLEAN = ROOT / "data" / "ttw_clean.csv"
INSIGHTS = ROOT / "public" / "data" / "insights.json"
ACTIVITIES = ROOT / "lib" / "data" / "activities.json"
DESTINATIONS = ROOT / "lib" / "data" / "destinations.json"


def clean_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", value)).strip()


def main() -> int:
    raw = pd.read_csv(RAW)
    clean = pd.read_csv(CLEAN)
    insights = json.loads(INSIGHTS.read_text(encoding="utf-8"))
    activities = json.loads(ACTIVITIES.read_text(encoding="utf-8"))
    destinations = json.loads(DESTINATIONS.read_text(encoding="utf-8"))

    dates = pd.to_datetime(raw["date"], errors="coerce")
    descriptions = raw["description"].fillna("").astype(str).str.strip()
    has_description = descriptions.ne("")
    clean_has_description = clean["has_description"].astype(str).str.lower().eq("true")
    resolved = clean["city_clean"].notna()
    usable = resolved & clean_has_description
    clean_descriptions = raw["description"].apply(clean_text)

    checks: list[dict[str, object]] = []

    def check(name: str, actual: object, expected: object) -> None:
        checks.append({
            "check": name,
            "passed": actual == expected,
            "actual": actual,
            "expected": expected,
        })

    check("colunas da base", list(raw.columns), ["id", "trip_id", "date", "city", "description"])
    check("IDs ausentes", int(raw["id"].isna().sum()), 0)
    check("IDs duplicados", int(raw["id"].duplicated().sum()), 0)
    check("datas inválidas", int(dates.isna().sum()), 0)
    trip_date_grain = raw.groupby("trip_id").agg(rows=("id", "size"), dates=("date", "nunique"))
    check("uma linha por dia dentro da viagem", int((trip_date_grain["rows"] != trip_date_grain["dates"]).sum()), 0)
    check("linhas preservadas na limpeza", len(clean), len(raw))
    check("IDs preservados na limpeza", set(clean["id"]), set(raw["id"]))

    kpis = insights["kpis"]
    check("KPI atividades", kpis["atividades"], len(raw))
    check("KPI viagens únicas", kpis["viagens"], int(raw["trip_id"].nunique()))
    check("KPI destinos canônicos", kpis["destinos"], int(clean["city_clean"].nunique()))
    check("KPI período", kpis["anos"], f"{dates.min().year}-{dates.max().year}")
    check("KPI cobertura de descrição", kpis["cobertura_descricao"], round(100 * has_description.mean(), 1))

    quality = insights["quality"]
    check("qualidade: destino resolvido", quality["linhas_com_destino_resolvido"], int(resolved.sum()))
    check("qualidade: linhas utilizáveis", quality["linhas_utilizaveis"], int(usable.sum()))
    check("qualidade: narrativas distintas", quality["narrativas_distintas"], int(clean_descriptions[has_description].nunique()))
    check(
        "qualidade: descrições com HTML",
        quality["descricoes_com_html"],
        int(raw["description"].fillna("").str.contains(r"<[^>]+>", regex=True).sum()),
    )

    expected_activity_ids = set(clean.loc[usable, "id"])
    check("corpus: total de atividades", len(activities), int(usable.sum()))
    check("corpus: IDs válidos", {row["id"] for row in activities}, expected_activity_ids)

    ranking = (
        clean.loc[usable]
        .groupby("city_clean")
        .size()
        .sort_values(ascending=False, kind="stable")
        .to_dict()
    )
    check(
        "ranking de destinos",
        {row["city"]: row["activities"] for row in insights["destinos_ranking"]},
        {str(city): int(count) for city, count in ranking.items()},
    )

    month_counts = dates.dt.month.value_counts().to_dict()
    check(
        "sazonalidade global",
        insights["sazonalidade_global"],
        [int(month_counts.get(month, 0)) for month in range(1, 13)],
    )

    year_counts = dates.dt.year.value_counts().to_dict()
    check(
        "distribuição anual",
        insights["por_ano"],
        [{"ano": str(year), "count": int(year_counts.get(year, 0))} for year in sorted(year_counts)],
    )

    trip_sizes = raw.groupby("trip_id").size()
    check("média de linhas por viagem", insights["duracao"]["media_dias_amostra"], round(float(trip_sizes.mean()), 2))
    check(
        "distribuição de linhas por viagem",
        insights["duracao"]["distribuicao"],
        {str(size): int(count) for size, count in trip_sizes.value_counts().sort_index().items()},
    )

    theme_counts: Counter[str] = Counter()
    for value in clean.loc[usable, "themes"].fillna(""):
        theme_counts.update(theme for theme in str(value).split("|") if theme)
    check(
        "frequência de temas",
        insights["temas_globais"],
        [{"theme": theme, "count": count} for theme, count in theme_counts.most_common()],
    )

    destination_map = {row["city"]: row for row in destinations}
    for city, group in clean.loc[usable].groupby("city_clean"):
        destination = destination_map[str(city)]
        unique_narratives = group["description"].apply(clean_text).nunique()
        check(f"{city}: registros", destination["activities"], len(group))
        check(f"{city}: viagens", destination["trips"], int(group["trip_id"].nunique()))
        check(f"{city}: narrativas distintas", destination["unique_narratives"], int(unique_narratives))

    failures = [item for item in checks if not item["passed"]]
    summary = {
        "status": "passed" if not failures else "failed",
        "checks": len(checks),
        "failures": failures,
        "dataset": {
            "rows": len(raw),
            "unique_trips": int(raw["trip_id"].nunique()),
            "usable_rows": int(usable.sum()),
            "usable_pct": round(100 * usable.mean(), 1),
            "filled_descriptions": int(has_description.sum()),
            "distinct_clean_narratives": int(clean_descriptions[has_description].nunique()),
            "html_descriptions": int(raw["description"].fillna("").str.contains(r"<[^>]+>", regex=True).sum()),
        },
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
