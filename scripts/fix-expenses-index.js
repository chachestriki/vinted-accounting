/**
 * Script para eliminar índices antiguos de la colección expenses
 * Ejecutar con: node scripts/fix-expenses-index.js
 * O desde MongoDB Compass/Shell:
 * db.expenses.dropIndex("gmailMessageId_1")
 * db.expenses.dropIndex("category_1")
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

async function fixExpensesIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI no encontrada en las variables de entorno");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Conectado a MongoDB");

    const db = mongoose.connection.db;
    const expensesCollection = db.collection("expenses");

    // Obtener todos los índices
    const indexes = await expensesCollection.indexes();
    console.log("\n📋 Índices actuales:");
    indexes.forEach((idx) => {
      console.log(`   - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Eliminar índices antiguos que pueden causar conflictos
    const indexesToRemove = ["gmailMessageId_1", "category_1"];

    for (const indexName of indexesToRemove) {
      try {
        const indexExists = indexes.some((idx) => idx.name === indexName);
        if (indexExists) {
          await expensesCollection.dropIndex(indexName);
          console.log(`\n✅ Índice eliminado: ${indexName}`);
        } else {
          console.log(`\n⏭️  Índice no existe (ya fue eliminado): ${indexName}`);
        }
      } catch (error) {
        if (error.codeName === "IndexNotFound") {
          console.log(`\n⏭️  Índice no encontrado: ${indexName}`);
        } else {
          console.error(`\n❌ Error eliminando índice ${indexName}:`, error.message);
        }
      }
    }

    // Verificar índices finales
    const finalIndexes = await expensesCollection.indexes();
    console.log("\n📋 Índices finales:");
    finalIndexes.forEach((idx) => {
      console.log(`   - ${idx.name}:`, JSON.stringify(idx.key));
    });

    console.log("\n✅ Proceso completado");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixExpensesIndexes();

