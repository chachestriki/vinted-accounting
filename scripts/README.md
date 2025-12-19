# Scripts de Mantenimiento

## fix-expenses-index.js

Este script elimina índices antiguos de la colección `expenses` que pueden causar conflictos con el esquema actual.

### Problema

El modelo `Expense` usa `emailId` como campo único, pero MongoDB puede tener índices antiguos como:
- `gmailMessageId_1` (campo antiguo)
- `category_1` (campo que ya no existe)

Estos índices pueden causar errores `E11000 duplicate key error` durante la sincronización.

### Uso

**Opción 1: Ejecutar el script Node.js**

```bash
node scripts/fix-expenses-index.js
```

**Opción 2: Ejecutar directamente en MongoDB**

Desde MongoDB Compass o mongosh:

```javascript
// Conectar a tu base de datos
use test  // o el nombre de tu base de datos

// Eliminar índices antiguos
db.expenses.dropIndex("gmailMessageId_1")
db.expenses.dropIndex("category_1")

// Verificar índices restantes
db.expenses.getIndexes()
```

### Índices que se eliminan

- `gmailMessageId_1` - Campo antiguo, ahora se usa `emailId`
- `category_1` - Campo que ya no existe en el modelo

### Índices que se mantienen

- `_id_` - Índice por defecto de MongoDB
- `userId_1` - Para búsquedas por usuario
- `expenseDate_1` - Para búsquedas por fecha
- `userId_1_expenseDate_-1` - Índice compuesto para búsquedas optimizadas
- `userId_1_emailId_1` - Índice compuesto para búsquedas por usuario y emailId

