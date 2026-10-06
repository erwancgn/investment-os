# Enveloppe de handoff 1.3.0

Chaque handoff conserve son bloc humain canonique et peut être exporté sous cette enveloppe :

```json
{
  "contract_version": "1.3.0",
  "plugin_version": "1.3.10",
  "run_id": "uuid-or-stable-string",
  "company": {
    "name": "",
    "ticker": "",
    "exchange": "",
    "currency": ""
  },
  "source_module": "earnings|business|valuation|short|portfolio|memo_cio",
  "analysis_date": "YYYY-MM-DD",
  "financial_period": "",
  "reference_price": null,
  "verdict": "",
  "score": null,
  "confidence": "low|medium|high",
  "limitations": [],
  "payload": {},
  "sources": [],
  "analytical_status": "COMPLETE|PARTIAL|FAILED|BLOCKED_INPUT",
  "persistence_status": "NOT_REQUIRED|VERIFIED|FAILED",
  "runtime_status": "PASS|FAIL",
  "evidence": {},
  "gaps": []
}
```

Règles :

- `score` reste nul pour Earnings Review, Short, Portfolio Fit et Memo CIO ;
- le `run_id` reste identique pendant un composite et ses retries ;
- le payload ne remplace pas le rapport complet ;
- les modules absents ne reçoivent jamais un faux handoff ;
- les dates et devises incompatibles sont signalées avant consolidation.
- aucun champ n'utilise `NA`, `N/A`, `NOT_APPLICABLE` ou `NOT_EXECUTED`.
