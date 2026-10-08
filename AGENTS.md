# Proyecto Análisis de Sistemas II — Cuentas por Pagar

- Este es un monorepo pnpm. Antes de modificar código, identifica su estructura
  y las convenciones implementadas en los módulos existentes.
- Mantén la arquitectura y metodología usadas en CxC. No reestructures
  paquetes ni regeneres el proyecto.
- Las tablas propias de Cuentas por Pagar usan el prefijo CXP_. No dupliques
  ni modifiques tablas compartidas de Compras o CxC sin autorización.
- Usa la estructura real de Oracle y los contratos existentes como fuentes
  de verdad. Si falta una columna, relación o regla de negocio, señálalo;
  no lo inventes.
- Alcance de Andrés: RF03–RF05, documentos y saldos, principalmente
  CXP_DOCUMENTO, CXP_DOCUMENTO_DETALLE, CXP_ARCHIVO y CXP_APLICACION.
- Los cambios en @erp/contracts deben considerar su uso por los demás
  integrantes. Explica cualquier cambio de interfaz antes de implementarlo.
- Antes de editar, presenta el flujo encontrado y los archivos que cambiarías.
- Implementa una funcionalidad a la vez. Al terminar, ejecuta las verificaciones
  disponibles y resume resultados, archivos modificados y pruebas pendientes.
- No ejecutes DDL, migraciones, borrados ni escrituras sobre Oracle compartido
  sin aprobación explícita.
- No muestres ni incluyas en commits credenciales, archivos .env, node_modules
  o archivos generados.