# Hao Materiales

Sistema de ventas y producción de láminas para `Hao Materiales`, con backend en Node.js/Express y frontend en React + Vite.

## Tecnologías usadas

### Backend
- Node.js
- Express
- MongoDB con Mongoose
- `express-session` para manejo de sesiones
- `cors` para habilitar el acceso desde el frontend en `localhost:5173`
- `dotenv` para cargar variables de entorno
- `bcrypt` para hashear contraseñas
- Swagger (`swagger-jsdoc`, `swagger-ui-express`) para documentación de API
- `nodemon` como dependencia de desarrollo

### Frontend
- React 19
- Vite
- React Router DOM
- Tailwind CSS
- ESLint

## Estructura de carpetas

```
/ (raíz del proyecto)
├─ backend/
│  ├─ config/
│  │  └─ db.js
│  ├─ middleware/
│  │  ├─ auth.js
│  │  └─ auditoria.js
│  ├─ models/
│  │  ├─ Lamina.js
│  │  ├─ LogAcceso.js
│  │  ├─ Pedido.js
│  │  ├─ PedidoCabecera.js
│  │  └─ User.js
│  ├─ routes/
│  │  ├─ admin.js
│  │  ├─ auth.js
│  │  ├─ despachador.js
│  │  ├─ operador.js
│  │  └─ pedidos.js
│  ├─ server.js
│  ├─ swagger.json
│  └─ package.json
├─ frontend/
│  └─ hao-react/
│     ├─ public/
│     ├─ src/
│     │  ├─ App.jsx
│     │  ├─ index.css
│     │  ├─ main.jsx
│     │  ├─ components/
│     │  │  ├─ Registro.jsx
│     │  │  └─ dashboards/
│     │  │     ├─ AdminDashboard.jsx
│     │  │     ├─ DespachadorDashboard.jsx
│     │  │     ├─ OperadorDashboard.jsx
│     │  │     └─ UserDashboard.jsx
│     ├─ package.json
│     ├─ vite.config.js
│     ├─ tailwind.config.js
│     ├─ postcss.config.js
│     └─ eslint.config.js
```

## Lógica del backend

### `backend/server.js`
- Configura Express, JSON y CORS.
- Configura la sesión con `express-session` para usar cookies entre backend y frontend.
- Conecta con MongoDB usando `config/db.js`.
- Monta rutas principales:
  - `/api/auth`
  - `/api/admin`
  - `/api/usuario`
  - `/api/operador`
  - `/api/despachador`
- Expone la documentación Swagger en `/api-docs`.

### `backend/config/db.js`
- Lee la variable de entorno `MONGO_URI`.
- Conecta con MongoDB.
- Configura `strictQuery` de Mongoose.

### `backend/middleware/auth.js`
- `requireLogin`: protege rutas que necesitan sesión activa.
- `requireRole`: protege rutas que requieren roles específicos.

### Modelos de datos

#### `backend/models/User.js`
- Usuarios con campos: `nombre`, `email`, `password_hash`, `telefono`, `direccion`, `activo` y `rol`.
- Roles definidos: `usuario`, `operador`, `despachador`, `administrador`.
- El esquema genera timestamps automáticos y transforma el JSON para ocultar `_id` y `__v`.

#### `backend/models/Lamina.js`
- Inventario de productos con `codigo`, `nombre`, `descripcion`, `stock` y `precio`.
- También guarda creación/actualización automática.

#### `backend/models/Pedido.js`
- Cada línea de pedido es un documento que referencia `usuario_id` y `lamina_id`.
- Tiene estado de producción: `PENDIENTE`, `CORTE`, `ENCHAPE`, `REFILADA`, `ZUNCHADA`, `LISTO`, `ENTREGADO`, `CANCELADO`.
- Incluye fechas de facturación y entrega, cantidad y notas de taller/logística.

#### `backend/models/PedidoCabecera.js`
- Contiene datos agregados por pedido: `numero_pedido`, `tipo_entrega`, `direccion_envio`, recargo, fechas y estado de la cabecera.
- Permite enlazar datos generales con las líneas de pedido.

#### `backend/models/LogAcceso.js`
- Guarda eventos de acceso como login.
- Almacena `usuario_id`, `tipo`, IP y user-agent.

### Rutas principales

#### `backend/routes/auth.js`
- `/registro`: crea un usuario nuevo con contraseña hasheada.
- `/login`: valida contraseña, crea sesión y registra login en `LogAcceso`.
- `/logout`: destruye la sesión.
- `/me`: devuelve información de sesión activa.

#### `backend/routes/admin.js`
- Protegido para roles `administrador`.
- Administra productos (`Lamina`) — creación, edición, ajuste de stock.
- Lista usuarios registrados.
- Consulta ventas, calcula totales por pedido y tipo de entrega.

#### `backend/routes/pedidos.js`
- Ruta de cliente general.
- `/catalogo`: devuelve productos disponibles.
- Maneja creación de pedidos con validación de stock y capacidad.
- Controla tipo de entrega `domicilio` o `punto_venta`.
- Valida límites diarios de producción y puede reprogramar fechas si hay cupo.
- Soporta pedidos en lote y agrupa líneas por código de lámina.

#### `backend/routes/operador.js`
- Protegido para `operador` y `administrador`.
- Devuelve la cola de producción ordenada por fases.
- Permite avanzar un pedido a la siguiente etapa de producción: `CORTE -> ENCHAPE -> REFILADA -> ZUNCHADA -> LISTO`.

#### `backend/routes/despachador.js`
- Protegido para `despachador` y `administrador`.
- Lista pedidos pendientes y listos.
- Envía pedidos al taller verificando la capacidad diaria máxima.
- Marca pedidos como entregados y maneja observaciones de logística.
- Une datos de `Pedido` con `PedidoCabecera` para calcular tipo de entrega y dirección.

## Lógica del frontend

### `frontend/hao-react/src/App.jsx`
- Define la aplicación como SPA con React Router.
- Contiene rutas para:
  - `/login`
  - `/registro`
  - `/admin`
  - `/usuario`
  - `/operador`
  - `/despachador`
- El componente `Login` verifica sesión con `/api/auth/me` al cargar.
- Redirige al dashboard correcto según el `rol` recibido del backend.

### `frontend/hao-react/src/components/Registro.jsx`
- Formulario de registro de usuario.
- Envía los datos a `/api/auth/registro`.
- Valida que la contraseña tenga al menos 6 caracteres.

### Dashboards
- `AdminDashboard.jsx`: panel administrador.
- `UserDashboard.jsx`: panel cliente.
- `OperadorDashboard.jsx`: panel de producción.
- `DespachadorDashboard.jsx`: panel de despacho.
- Cada dashboard consume la API backend según el rol correspondiente.

## Configuración y ejecución

### Backend
1. Entrar a `backend`
2. Crear archivo `.env` con `MONGO_URI` y opcionalmente `SESSION_SECRET` y `PORT`
3. Ejecutar:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Frontend
1. Entrar a `frontend/hao-react`
2. Ejecutar:
   ```bash
   cd frontend/hao-react
   npm install
   npm run dev
   ```

### Variables de entorno recomendadas
- `MONGO_URI`: URI de conexión de MongoDB
- `SESSION_SECRET`: clave secreta para sesiones
- `PORT`: puerto del backend (por defecto `3000`)

## Notas importantes
- El backend espera peticiones desde `http://localhost:5173`.
- La autenticación se mantiene con cookies de sesión (`credentials: 'include'`).
- El sistema usa roles para controlar acceso a rutas.
- Hay un límite diario de capacidad de producción de `30` láminas.
- Admite envío a domicilio o retiro en punto de venta.

---

Este README describe la arquitectura general, los componentes principales y cómo funciona cada parte clave del proyecto.
