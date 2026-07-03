#!/usr/bin/env python3
"""
Importa stock desde Google Sheets y genera productos-hombre.js (o productos-mujer.js).

Uso:
  python scripts/importar-stock.py hombre
  python scripts/importar-stock.py hombre --dry-run
  python scripts/importar-stock.py mujer

Requisitos:
  - La hoja debe estar compartida como "Cualquier persona con el enlace puede ver".
  - Las imágenes deben llamarse {id}.png y {id}.1.png dentro de hombre/ o mujer/.
  - Solo se importan filas con CANTIDAD > 0 y nombre no vacío.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# -----------------------------------------------------------------------------
# Configuración del Google Sheet
# -----------------------------------------------------------------------------
SPREADSHEET_ID = "195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko"

HOJAS = {
    "hombre": {
        "sheet": "HOMBRE",
        "categoria": "Hombre",
        "carpeta_imagenes": "hombre",
        "archivo_salida": "productos-hombre.js",
        "variable_js": "productosHombre",
    },
    "mujer": {
        "sheet": "MUJER",
        "categoria": "Mujer",
        "carpeta_imagenes": "mujer",
        "archivo_salida": "productos-mujer.js",
        "variable_js": "productosMujer",
    },
}

# Mapeo de columnas del sheet (letras de Google Sheets, base 1)
# Columna A suele estar oculta/vacía; los datos visibles empiezan en B.
COLUMNAS = {
    "nombre": "B",
    "stock": "C",
    "talla": "D",
    "color": "E",
    "tipo": "F",
    "marca": "G",
    "precio": "H",
}

FILA_INICIO_DATOS = 3  # Primera fila de producto (fila 1 = título, fila 2 = encabezados)

# -----------------------------------------------------------------------------
# Normalización
# -----------------------------------------------------------------------------
MARCAS = {
    "GYMSHARK": "Gym Shark",
    "GYM SHARK": "Gym Shark",
    "GYM-SHARK": "Gym Shark",
    "YOUNGLA": "YoungLA",
    "YOUNG LA": "YoungLA",
    "YOUNG-LA": "YoungLA",
    "UNIQLO": "Uniqlo",
    "ON CLOUD": "On Cloud",
    "ON-CLOUD": "On Cloud",
}

COLORES = {
    "BLACK": "Negro",
    "WHITE": "Blanco",
    "GREY": "Gris",
    "GRAY": "Gris",
    "GRIS": "Gris",
    "GREEN": "Verde",
    "VERDE": "Verde",
    "BLUE": "Azul",
    "RED": "Rojo",
    "BROWN": "Marrón",
    "BEIGE": "Beige",
    "TEAL": "Verde azulado",
    "PINK": "Rosa",
    "ROSA": "Rosa",
    "YELLOW": "Amarillo",
    "ORANGE": "Naranja",
    "PURPLE": "Morado",
    "NAVY": "Azul marino",
}


def columna_a_indice(letra: str) -> int:
    """Convierte letra de columna (A, B, C...) a índice 0-based."""
    letra = letra.strip().upper()
    valor = 0
    for ch in letra:
        valor = valor * 26 + (ord(ch) - ord("A") + 1)
    return valor - 1


def descargar_csv(spreadsheet_id: str, nombre_hoja: str) -> str:
    from urllib.parse import quote

    url = (
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        f"/gviz/tq?tqx=out:csv&sheet={quote(nombre_hoja)}"
    )
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read().decode("utf-8-sig")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"No se pudo descargar la hoja (HTTP {exc.code}). "
            "Verifica que el sheet esté público: "
            "Compartir → Cualquier persona con el enlace → Lector."
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Error de conexión al descargar el sheet: {exc}") from exc


def parsear_precio(valor: str) -> float:
    if not valor or not str(valor).strip():
        return 0.0
    texto = str(valor).strip().replace("$", "").replace(" ", "")
    # Formato europeo/latino: 1.500,50
    if "," in texto and "." in texto:
        if texto.rfind(",") > texto.rfind("."):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "," in texto:
        parte = texto.split(",")[-1]
        texto = texto.replace(",", ".") if len(parte) == 2 else texto.replace(",", "")
    else:
        # Solo puntos como separador de miles: 1.500
        if re.fullmatch(r"\d{1,3}(\.\d{3})+", texto):
            texto = texto.replace(".", "")
    try:
        return round(float(texto), 2)
    except ValueError:
        return 0.0


def parsear_stock(valor: str) -> int:
    if not valor or not str(valor).strip():
        return 0
    try:
        return int(float(str(valor).strip().replace(",", ".")))
    except ValueError:
        return 0


def normalizar_marca(valor: str) -> str:
    clave = re.sub(r"\s+", " ", str(valor or "").strip()).upper()
    return MARCAS.get(clave, valor.strip().title())


def normalizar_color(valor: str) -> str:
    clave = str(valor or "").strip().upper()
    if not clave:
        return ""
    if clave in COLORES:
        return COLORES[clave]
    return valor.strip().title()


def normalizar_tipo(valor: str) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return ""
    mapa = {
        "T-SHIRT": "T-Shirt",
        "TSHIRT": "T-Shirt",
        "TEE": "T-Shirt",
        "TANK TOP": "Tank Top",
        "TANK": "Tank Top",
        "HOODIE": "Hoodie",
        "JOGGERS": "Joggers",
        "PANTS": "Pants",
        "SHORT": "Short",
        "JERSEY": "Jersey",
        "POLO": "Polo",
        "CAP": "Cap",
        "CAPS": "Cap",
    }
    clave = texto.upper()
    return mapa.get(clave, texto.title())


def obtener_valor(fila: list[str], indice: int) -> str:
    if indice < 0 or indice >= len(fila):
        return ""
    return str(fila[indice]).strip()


def resolver_imagenes(carpeta: Path, carpeta_rel: str, producto_id: int) -> tuple[str, str]:
    extensiones = (".webp", ".png", ".jpg", ".jpeg")

    def buscar(sufijo: str) -> str:
        for ext in extensiones:
            if (carpeta / f"{producto_id}{sufijo}{ext}").exists():
                return f"{carpeta_rel}/{producto_id}{sufijo}{ext}"
        return ""

    return buscar(""), buscar(".1")


def leer_productos_desde_csv(
    csv_texto: str,
    categoria: str,
    carpeta_imagenes: Path,
    carpeta_rel: str,
) -> list[dict]:
    filas = list(csv.reader(io.StringIO(csv_texto)))
    if len(filas) < FILA_INICIO_DATOS:
        raise RuntimeError("La hoja no tiene suficientes filas.")

    idx = {nombre: columna_a_indice(letra) for nombre, letra in COLUMNAS.items()}
    productos: list[dict] = []
    omitidos = 0
    nuevo_id = 1

    for num_fila, fila in enumerate(filas[FILA_INICIO_DATOS - 1 :], start=FILA_INICIO_DATOS):
        nombre = obtener_valor(fila, idx["nombre"])
        stock = parsear_stock(obtener_valor(fila, idx["stock"]))

        if not nombre:
            continue
        if stock <= 0:
            omitidos += 1
            continue

        talla_raw = obtener_valor(fila, idx["talla"])
        precio = parsear_precio(obtener_valor(fila, idx["precio"]))
        if precio <= 0:
            print(f"  [!] Fila {num_fila}: '{nombre}' sin precio válido, se omite.")
            omitidos += 1
            continue

        imagen1, imagen2 = resolver_imagenes(carpeta_imagenes, carpeta_rel, nuevo_id)

        productos.append(
            {
                "id": nuevo_id,
                "nombre": nombre,
                "categoria": categoria,
                "precio": precio,
                "stock": stock,
                "imagen1": imagen1,
                "imagen2": imagen2,
                "talla": talla_raw,
                "tallaBase": talla_raw,
                "tipo": normalizar_tipo(obtener_valor(fila, idx["tipo"])),
                "color": normalizar_color(obtener_valor(fila, idx["color"])),
                "marca": normalizar_marca(obtener_valor(fila, idx["marca"])),
            }
        )
        nuevo_id += 1

    print(f"  Filas omitidas (sin stock o sin datos): {omitidos}")
    return productos


def producto_a_js(producto: dict, indent: str = "    ") -> str:
    campos = [
        ("id", producto["id"], False),
        ("nombre", producto["nombre"], True),
        ("categoria", producto["categoria"], True),
        ("precio", f"{producto['precio']:.2f}", False),
        ("stock", producto["stock"], False),
        ("imagen1", producto["imagen1"], True),
        ("imagen2", producto["imagen2"], True),
        ("talla", producto["talla"], True),
        ("tallaBase", producto["tallaBase"], True),
        ("tipo", producto["tipo"], True),
        ("color", producto["color"], True),
        ("marca", producto["marca"], True),
    ]

    lineas = [f"{indent}{{"]
    for i, (clave, valor, es_texto) in enumerate(campos):
        coma = "," if i < len(campos) - 1 else ""
        if es_texto:
            valor_js = json.dumps(valor, ensure_ascii=False)
            lineas.append(f'{indent}    {clave}: {valor_js}{coma}')
        else:
            lineas.append(f"{indent}    {clave}: {valor}{coma}")
    lineas.append(f"{indent}}}")
    return "\n".join(lineas)


def generar_archivo_js(productos: list[dict], variable_js: str, categoria: str) -> str:
    bloques = ",\n".join(producto_a_js(p) for p in productos)
    return f"""// =============================================================================
// STOCK {categoria.upper()} — Generado automáticamente con scripts/importar-stock.py
// Fuente: Google Sheets (hoja {categoria.upper()})
// Edita el sheet y vuelve a ejecutar el script para actualizar.
// =============================================================================
const {variable_js} = [
{bloques}
];
"""


def contar_imagenes_faltantes(productos: list[dict], carpeta: Path) -> list[int]:
    faltantes = []
    for p in productos:
        img = carpeta / Path(p["imagen1"]).name
        if not img.exists():
            faltantes.append(p["id"])
    return faltantes


def main() -> int:
    parser = argparse.ArgumentParser(description="Importar stock desde Google Sheets")
    parser.add_argument(
        "hoja",
        choices=sorted(HOJAS.keys()),
        help="Hoja a importar (hombre o mujer)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo muestra resumen sin escribir archivo",
    )
    parser.add_argument(
        "--sheet",
        help="Sobrescribe el nombre de la hoja (ej. MUJER)",
    )
    args = parser.parse_args()

    config = HOJAS[args.hoja]
    nombre_hoja = args.sheet or config["sheet"]
    raiz = Path(__file__).resolve().parent.parent
    carpeta_img = raiz / config["carpeta_imagenes"]
    archivo_salida = raiz / config["archivo_salida"]

    print(f"Descargando hoja '{nombre_hoja}'...")
    csv_texto = descargar_csv(SPREADSHEET_ID, nombre_hoja)

    print("Procesando filas...")
    productos = leer_productos_desde_csv(
        csv_texto,
        config["categoria"],
        carpeta_img,
        config["carpeta_imagenes"],
    )

    if not productos:
        print("No se encontraron productos con stock disponible.")
        return 1

    faltantes = contar_imagenes_faltantes(productos, carpeta_img)
    marcas = {}
    for p in productos:
        marcas[p["marca"]] = marcas.get(p["marca"], 0) + 1

    print(f"\nResumen:")
    print(f"  Productos importados: {len(productos)}")
    print(f"  IDs: 1 -> {productos[-1]['id']}")
    print(f"  Marcas: {', '.join(f'{k} ({v})' for k, v in sorted(marcas.items()))}")
    print(f"  Imágenes faltantes en {config['carpeta_imagenes']}/: {len(faltantes)}")
    if faltantes and len(faltantes) <= 20:
        print(f"    IDs sin imagen: {', '.join(map(str, faltantes))}")
    elif faltantes:
        print(f"    Primeros IDs sin imagen: {', '.join(map(str, faltantes[:15]))}...")

    if args.dry_run:
        print("\n[DRY-RUN] No se escribió ningún archivo.")
        print("\nPrimeros 3 productos:")
        for p in productos[:3]:
            print(f"  #{p['id']} {p['nombre']} | stock={p['stock']} | {p['marca']} | ${p['precio']:.2f}")
        return 0

    contenido = generar_archivo_js(productos, config["variable_js"], config["categoria"])
    archivo_salida.write_text(contenido, encoding="utf-8")
    print(f"\nArchivo generado: {archivo_salida}")
    print("Recarga http://localhost:5500 para ver los cambios.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
