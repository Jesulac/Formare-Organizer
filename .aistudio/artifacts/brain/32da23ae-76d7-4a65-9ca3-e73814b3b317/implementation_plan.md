# Blindaje de Datos ante Despliegues y Columna 15% (Sandra) en Gastos en General

Este plan garantiza que ningún cambio de código o redespliegue sobrescriba ni borre las operaciones o el stock de filamentos guardados por el usuario, e incorpora el cálculo automático del 15 % (`precio × 0,15`) para las ventas de **Sandra** o **Jorge, Sandra**, mostrándolo en su propia columna y sumándolo a **Gastos en General**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Se han confirmado las decisiones clave para proteger tus datos y contabilizar el 15 % en las ventas de Sandra:

- **Confirmed Decision 1 (Persistencia blindada sin servicios externos)**: Se blindará el motor de almacenamiento actual (`localStorage` + `IndexedDB` + sincronización con el servidor) eliminando cualquier marca de tiempo artificial en los datos base del repositorio para que un redespliegue nunca machaque tus datos reales.
- **Confirmed Decision 2 (Fusión inteligente de cambios más recientes)**: Al cargar o reconectar tras una subida de cambios, la aplicación fusionará automáticamente las operaciones del navegador y del servidor conservando siempre los registros nuevos, la versión más reciente de cada operación editada y respetando los borrados intencionados.
- **Confirmed Decision 3 (Columna `Precio × 0,15` para Sandra / Jorge, Sandra en Gastos en General)**: Cuando el vendedor de una venta sea **«Sandra»** o **«Jorge, Sandra»**, se calculará automáticamente `precio × 0,15`, se mostrará en una nueva columna específica en la tabla (y en las tarjetas móviles/modal) y su importe se sumará directamente al apartado **Gastos en General**.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Blindaje Total de Datos (Zero-Overwrite Sync)**: Impide que los datos iniciales del proyecto pisen las operaciones reales al actualizar la aplicación o reiniciar instancias serverless. El navegador actúa como bóveda autoritativa y fusiona cualquier cambio reciente por ID y marca de tiempo (`updatedAt`).
  2. **Columna `15% Sandra (Precio × 0,15)` y Suma en Gastos en General**: Añade una columna dedicada en el listado de operaciones que calcula el 15 % del precio de venta cuando el vendedor es **Sandra** o **Jorge, Sandra**, acumulando ese importe dentro de la métrica **Gastos en General** (tanto en el panel superior como en los cierres mensuales e informes PDF), sin restarlo del **Beneficio Neto** de producción.
- **Target Audience / Persona**: Gestión financiera y de producción de Formare 3D en escritorio y móvil (iOS / OLED).
- **Key Value**: Tranquilidad total al pedir mejoras y desplegar nuevas versiones sin perder ni un solo dato, junto con el control automático del 15 % correspondiente a las ventas de Sandra dentro de Gastos en General.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Actualización o Redespliegue Transparente**:
     - Al abrir la app tras subir una nueva versión, el motor detecta el historial guardado en el dispositivo (`localStorage` / `IndexedDB`), lo fusiona con el estado del servidor conservando todas las operaciones añadidas o editadas más recientemente y actualiza silenciosamente el servidor.
  2. **Ventas con Vendedor «Sandra» o «Jorge, Sandra»**:
     - Al crear o editar una venta y elegir **«Sandra»** o **«Jorge, Sandra»** en el desplegable de Vendedor, el modal muestra en tiempo real el importe `Precio × 0,15` que irá a **Gastos en General**.
     - En la tabla de operaciones aparece una nueva columna **`15% Sandra`** (junto a Unidades, Material, Precio y Costes) que muestra el importe exacto (`precio × 0,15 €`) en tipografía monoespaciada tabular para esas operaciones, o `—` cuando el vendedor no incluye a Sandra.
     - La tarjeta superior **Gastos en General**, el cierre mensual y el resumen PDF suman automáticamente todos los importes `precio × 0,15` de dichas ventas junto a las compras de bobinas y gastos generales.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Diseño OLED oscuro de alto contraste estilo iOS 26 (`#000000` fondo base, tarjetas `glass-card` translúcidas con bordes `border-white/10`).
  - *Color Palette & Mood*:
    - Superficie primaria: `#000000` y `#09090b` (`zinc-950`).
    - Acento de beneficio y acciones primarias: Esmeralda (`#10b981` / `emerald-400`).
    - Acento para Gastos de Producción: Azul cielo (`#38bdf8` / `sky-300`).
    - Acento para Gastos en General y columna `15% Sandra`: Rosa coral (`#fb7185` / `rose-300` y Violeta `#c4b5fd` / `purple-300`).
  - *Typography & Hierarchy*: Fuente sin serifa limpia para etiquetas y `font-mono` con `tabular-nums` para todos los importes en euros, gramos y porcentajes.
  - *Component Styling & Layout*: La tabla horizontal incorpora la nueva columna sin romper la alineación de cabeceras ni el fila de cierre mensual, y las tarjetas móviles muestran el desglose compacto cuando aplica.
- **Interactive Feedback & Motion**: Indicadores instantáneos en el modal al cambiar el vendedor o el precio, y notificación no intrusiva de guardado en tiempo real.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Fusión por Operación (`updatedAt` + registro de eliminados) frente a reemplazo completo de lista**
  - *Chosen Approach*: Cada operación guarda su marca de tiempo de modificación (`updatedAt`) y el almacenamiento registra los IDs eliminados (`deletedIds`) y los ajustes de stock con su marca temporal. Al sincronizar navegador y servidor, se unen ambas colecciones conservando la versión más reciente de cada operación.
  - *Why*: Si el servidor se reinicia tras un despliegue en Vercel con datos antiguos, nunca puede borrar las operaciones nuevas creadas por el usuario; al contrario, el navegador restaura inmediatamente el estado completo en el servidor.
  - *Alternatives Considered*: Reemplazar toda la lista si el servidor responde primero (descartado porque en un arranque en frío tras desplegar podía sobrescribir los datos locales).
- **Decision 2: Contabilización del `Precio × 0,15` en Gastos en General sin alterar el Beneficio Neto de Producción**
  - *Chosen Approach*: El 15 % del precio de venta en operaciones de **Sandra** o **Jorge, Sandra** se suma a **Gastos en General** (`gastosGenerales` y `dineroGastadoCompras`), manteniendo **Beneficio Neto** estrictamente como `Ventas - Gastos de Producción`.
  - *Why*: Cumple exactamente la regla contable solicitada donde los gastos de producción (filamento y costes de fabricación) determinan el beneficio neto de producción, mientras que compras de bobinas y el 15 % de Sandra se acumulan en **Gastos en General**.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                   MOTOR DE PERSISTENCIA Y FUSIÓN BLINDADA                 │
│                                                                           │
│  ┌─────────────────────────┐          ┌────────────────────────────────┐  │
│  │ Navegador del Usuario   │          │ Servidor / Función Serverless  │  │
│  │ (localStorage + IDB)    │◄────────►│ (Estado en memoria / disco)    │  │
│  │ - operations[]          │  Fusión  │ - Base limpia (server-init)    │  │
│  │ - deletedIds{}          │  por ID  │ - Nunca pisa datos con         │  │
│  │ - filamentAdjustments{} │  y fecha │   updatedAt más reciente       │  │
│  └───────────┬─────────────┘          └────────────────────────────────┘  │
└──────────────┼────────────────────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    CÁLCULO FINANCIERO Y VISTAS UI                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Regla Vendedor Sandra / Jorge, Sandra (en Ventas):                  │  │
│  │ comisionSandra = (vendedor incluye "Sandra") ? precio * 0.15 : 0    │  │
│  └───────────────┬───────────────────────────────────┬─────────────────┘  │
│                  │                                   │                    │
│                  ▼                                   ▼                    │
│  ┌───────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │ Listado y Modal de Operación  │   │ Tarjetas, Cierre Mensual y PDF  │  │
│  │ - Nueva columna: 15% Sandra   │   │ - Gastos Producción: filamento  │  │
│  │ - Detalle en tarjeta móvil    │   │ - Gastos en General: compras +  │  │
│  │ - Vista previa en el modal    │   │   suma(precio * 0.15 de Sandra) │  │
│  │                               │   │ - Beneficio: Ventas - Producción│  │
│  └───────────────────────────────┘   └─────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Cada registro `Operation` incluye `updatedAt?: number` para resolver conflictos a favor del cambio más reciente.
  - El contenedor persistido `PersistedPayload` añade `deletedIds?: Record<string, number>` para recordar qué operaciones o filamentos fueron eliminados por el usuario y evitar que reaparezcan al fusionar.
  - Función utilitaria `calculateSandraExpense(op)`: devuelve `Number(((op.precio || 0) * 0.15).toFixed(2))` cuando `op.tipo === 'venta'` y `op.vendedor` es `Sandra` o `Jorge, Sandra` (y `0` en caso contrario).
- **Interactive Component & State Mapping**:
  - **Hidratación y Sincronización**: Al iniciar o recibir eventos del servidor, se ejecuta la fusión inteligente; si el resultado fusionado contiene operaciones locales que el servidor no tenía tras un despliegue, se envía automáticamente al servidor para actualizarlo.
  - **Tabla y Tarjetas de Operaciones**: Renderiza la nueva columna **`15% Sandra`** entre las columnas de datos/importes de la tabla, ajustando el `colSpan` del cierre mensual para mantener la estructura intacta.
  - **Panel Superior, Cierres Mensuales y PDF**: Suma `calculateSandraExpense(op)` dentro de `gastosGenerales` / `dineroGastadoCompras` en tiempo real.
