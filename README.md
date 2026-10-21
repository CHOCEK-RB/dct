# dct

https://chocek-rb.github.io/dct/

## Uso

1. Escribe el mensaje (solo A–Z; el resto se normaliza) y las dos claves (2–16 letras).
2. Pulsa **Ejecutar cifrado** o `Ctrl + Enter`.
3. Avanza por las seis estaciones para ver cada matriz y cada lectura por columnas.

## Desarrollo

```sh
bun install
bun run dev
```

| Comando           | Qué hace                          |
| ----------------- | --------------------------------- |
| `bun run dev`     | Servidor de desarrollo            |
| `bun run build`   | Genera el sitio estático en `build/` |
| `bun run preview` | Sirve el build local              |
| `bun run check`   | Chequeo de tipos y Svelte         |
| `bun run test`    | Tests del cifrado                 |

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instala, chequea, testea, compila y publica en GitHub Pages.
