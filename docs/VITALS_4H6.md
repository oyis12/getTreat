# GetTreat 4H-6 — Vital History & Report

## Existing endpoint

### GET `/api/user/vitals`

Returns the patient's vitals history, newest first.

Optional query filters:

- `date=YYYY-MM-DD` — records recorded on that UTC calendar date.
- `from=YYYY-MM-DD&to=YYYY-MM-DD` — inclusive date range. Either bound may be omitted.

Do not combine `date` with `from` or `to`.

Response shape:

```json
{
  "success": true,
  "msg": "Vitals retrieved successfully",
  "data": {
    "filters": {
      "date": null,
      "from": null,
      "to": null
    },
    "latest": {},
    "history": [],
    "total_records": 0,
    "total_records_all": 0
  }
}
```

`latest` is the newest record within the requested filter. Without a filter it is the newest record overall.

## Vital report endpoint

### GET `/api/user/vitals/report`

Uses the same `date`, `from`, and `to` filters and returns report/chart-ready data without clinical interpretation.

```json
{
  "success": true,
  "msg": "Vital report retrieved successfully",
  "data": {
    "filters": {
      "date": null,
      "from": "2026-09-01",
      "to": "2026-09-27"
    },
    "total_records": 3,
    "records": [],
    "chart": {
      "blood_pressure": [],
      "sugar_level": []
    }
  }
}
```

The chart series preserve the stored sugar unit. No mmol/L ↔ mg/dL conversion is performed.

## Sugar units

The Record Vital and Update Vital validators accept:

- `mg/dL`
- `mmol/L`

Mongoose stores the normalized lowercase representation (`mg/dl` or `mmol/l`).

## Sugar Difference

The Figma contains a `SUGAR DIFFERENCE` display, but the available product requirements do not define its calculation or clinical meaning. It is therefore intentionally not calculated by the backend in 4H-6.

Do not infer a formula from the label alone. A confirmed product/clinical rule is required before implementing it.
