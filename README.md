# platform-cms

CDK stacks for a translation API, a websocket API, and a prices DynamoDB table. Archived snapshot, as-is.

This tree is a **new public commit** with no git history. The original private archive is `eulertools/platform-cms-archive`.

## What was built (EN)

Lambdas under `src/` (language translations, prices, websocket connect/disconnect/send). Hosted-zone choice uses `CDK_DEV_ACCOUNT` (`dev.euler.tools` vs `prod.euler.tools`). Generated `cdk.context.json` (VPC, subnets, hosted-zone id, AWS account) was **removed** from this snapshot.

No contract deployments.

## Qué se construyó (ES)

CMS/traducciones + websockets + precios. Contexto CDK de AWS eliminado.

---

## Notice / Aviso

**Euler Tools ha cerrado. Euler Tools is closed.**

La empresa quebró. Este repositorio está archivado y no se mantiene. El software se ofrece tal cual (as is), sin garantía ni soporte. Parte del material puede ser reclamado por acreedores.

The company went bankrupt. This repository is archived and unmaintained. Software is provided as is, with no warranty and no support. Some material may be claimed by creditors.

Site: https://euler.tools  
Org: https://github.com/eulertools  
Enquiries: https://sinequix.com · https://github.com/tebayoso
