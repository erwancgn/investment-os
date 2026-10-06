# Contrat d’adaptateur de persistance

Version : `1.0.0`.

Contrat historique pour un adaptateur externe explicitement choisi, hors transport MCP actif. Les opérations abstraites ci-dessous ne sont pas des tools MCP. Le flux officiel READ-only utilise le [contrat MCP](investment-os-mcp.md) ; une future écriture y sera une seule soumission `save_analysis`, orchestration confiée au Core et à ses adapters.

## Handshake

L’adaptateur expose ses capacités sans écriture :

```yaml
provider: ""
adapter_version: ""
can_read_companies: false
can_create_companies: false
can_write_analyses: false
can_verify_writes: false
can_version_analyses: false
can_read_portfolio: false
can_store_runs: false
can_store_handoffs: false
can_resume_runs: false
```

## Opérations

- `inspect_capabilities()` ;
- `resolve_company(identity)` ;
- `create_company(identity, idempotency_key)` lorsque l'identité est non ambiguë et que le provider l'autorise ;
- `read_current_analysis(company, module)` ;
- `write_analysis(idempotency_key, analysis)` ;
- `verify_analysis(external_id, expected)` ;
- `write_handoff(idempotency_key, handoff)` ;
- `update_current(company_id, module, analysis_id)` ;
- `mark_superseded(previous_id)` ;
- `read_portfolio_snapshot(as_of)` ;
- `save_checkpoint(run_id, checkpoint)` ;
- `resume_run(run_id)`.

## Réponse normalisée

```yaml
status: "succeeded|failed|skipped"
external_id: null
version: null
timestamp: ""
retryable: false
error_code: null
message: null
```

## Invariants

- clé d’idempotence : `(run_id, module, version)` ;
- clé d'idempotence Company : `(legal_name, ticker, exchange)` normalisé ;
- aucune écriture de `Previous Version` ;
- aucune supersession avant vérification de la nouvelle analyse et du nouveau Current ;
- aucune déclaration de succès sans relecture ;
- aucun secret dans un handoff ou un log ;
- aucune mutation de portefeuille ;
- un adaptateur incomplet annonce son niveau maximal sans simuler les capacités manquantes.
- un échec de Current déclenche au plus une compensation sûre vers Draft ; un échec de supersession conserve le nouveau Current et retourne FAILED.
