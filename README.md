# GetTreat — Phase 4I My Baby Progress

This is a focused implementation bundle. It is **not** a replacement for the whole GetTreat project.

## Files

- `models/pregnancy.model.js` — adds `baby.growth_history`
- `services/baby.service.js` — registration baseline + historical measurement updates + legacy-field synchronization
- `services/baby-progress.service.js` — growth history, progress, age, date filtering, report/chart serialization, mathematical percentage changes, percentile/milestone placeholders
- `controllers/baby-progress.controller.js`
- `routes/baby-progress.routes.js`
- `validators/baby.validator.js` — growth-record validation
- `server.js` — registers baby and baby-progress routes in the extracted project baseline

## Endpoints

### Add historical growth record
`POST /api/user/babies/:babyId/growth`

```json
{
  "weight": { "value": 7.9, "unit": "kg" },
  "length": { "value": 100, "unit": "cm" },
  "head_circumference": { "value": 43, "unit": "cm" }
}
```

Optional `recorded_at` is accepted and cannot be in the future.

### Growth history
`GET /api/user/babies/:babyId/growth`

Supports exactly one of:
- `?date=YYYY-MM-DD`
- `?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Progress
`GET /api/user/babies/:babyId/progress`

Returns baby identity, calculated calendar age, latest/previous growth, mathematical changes and percentage changes, plus explicit percentile/milestone data states.

### Progress report
`GET /api/user/babies/:babyId/progress/report`

Returns filtered records and chart-ready series for weight, length and head circumference.

## Important clinical-data boundary

Actual clinical growth percentiles and developmental milestones are **not fabricated**. Their response contracts are implemented, but the values/items remain unavailable until GetTreat provides an approved clinical reference standard/data source. The mathematical measurement change/percentage calculation is independent of clinical interpretation.

## Age formatting

The age calculation preserves calendar years/months/days. For babies under one month, it uses weeks + remaining days when appropriate, e.g. `1 week and 4 days`. For older children it can return forms such as `2 months and 20 days` or `4 years and 2 months and 12 days`.

## Backward compatibility

Existing top-level baby `weight`, `length`, and `head_circumference` fields remain. Registration measurements are copied into `growth_history` as the `registration` baseline. Later measurement updates append `patient_update` records and synchronize the legacy top-level fields to the newest supplied values.

## Testing status

JavaScript syntax checks passed for all modified/new files. Full integration/Postman testing requires the actual project dependencies, MongoDB environment and authenticated patient data; do not mark 4I complete until those tests pass.
