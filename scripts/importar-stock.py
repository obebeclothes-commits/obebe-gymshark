#!/usr/bin/env python3
"""
Importa stock desde Google Sheets y genera productos-hombre.js (o productos-mujer.js).

Uso:
  python scripts/importar-stock.py hombre
  python scripts/importar-stock.py hombre --dry-run
  python scripts/importar-stock.py mujer

Requisitos:
  - La hoja debe estar compartida como "Cualquier persona con el enlace puede ver".
  - La hoja INVENTARIO unifica hombre y mujer; columna T = HOMBRE o MUJER.
  - Columna J puede mostrar vista previa con scripts/actualizar-columna-j-imagenes.py
  - Se importan filas con nombre y precio válidos (incluye stock 0 / agotados).
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
from collections import Counter
from pathlib import Path

# -----------------------------------------------------------------------------
# Configuración del Google Sheet
# -----------------------------------------------------------------------------
SPREADSHEET_ID = "195xshQr985FH1FI4xzBhQrvrBEayAE5_manTNrfH-ko"
HOJA_INVENTARIO = "INVENTARIO"
HOJA_INVENTARIO_LEGACY = "HOMBRE"
GID_INVENTARIO = 0  # pestaña INVENTARIO
BASE_URL_IMAGENES = "https://obebeclothes-commits.github.io/obebe-gymshark"

HOJAS = {
    "hombre": {
        "sheet": HOJA_INVENTARIO,
        "categoria": "Hombre",
        "carpeta_imagenes": "hombre",
        "archivo_salida": "productos-hombre.js",
        "variable_js": "productosHombre",
    },
    "mujer": {
        "sheet": HOJA_INVENTARIO,
        "categoria": "Mujer",
        "carpeta_imagenes": "mujer",
        "archivo_salida": "productos-mujer.js",
        "variable_js": "productosMujer",
    },
}

# Mapeo de columnas del sheet (letras de Google Sheets, base 1)
COLUMNAS = {
    "imagen": "A",
    "nombre": "B",
    "stock": "C",
    "talla": "D",
    "color": "E",
    "tipo": "F",
    "marca": "G",
    "precio": "H",
    "fecha_stock": "K",
    "vista_imagen": "J",
    "precio_mayoreo": "P",
    "mayoreo": "R",
    "segmento": "T",
    "carrusel": "U",
    "coleccion": "X",
    "oferta_semanal": "Y",
    "ubicacion": "AB",
}

MESES_FECHA_STOCK = {
    "ene": 0, "enero": 0, "feb": 1, "febrero": 1, "mar": 2, "marzo": 2,
    "abr": 3, "abril": 3, "may": 4, "mayo": 4, "jun": 5, "junio": 5,
    "jul": 6, "julio": 6, "ago": 7, "agosto": 7, "sep": 8, "sept": 8,
    "septiembre": 8, "oct": 9, "octubre": 9, "nov": 10, "noviembre": 10,
    "dic": 11, "diciembre": 11,
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
    "NEGRO": "Negro",
    "WHITE": "Blanco",
    "BLANCO": "Blanco",
    "GREY": "Gris",
    "GRAY": "Gris",
    "GRIS": "Gris",
    "GREEN": "Verde",
    "VERDE": "Verde",
    "BLUE": "Azul",
    "AZUL": "Azul",
    "RED": "Rojo",
    "ROJO": "Rojo",
    "BROWN": "Marrón",
    "CAFE": "Marrón",
    "CAFÉ": "Marrón",
    "MARRON": "Marrón",
    "MARRÓN": "Marrón",
    "BEIGE": "Beige",
    "PINK": "Rosa",
    "ROSA": "Rosa",
    "YELLOW": "Amarillo",
    "AMARILLO": "Amarillo",
    "ORANGE": "Naranja",
    "NARANJA": "Naranja",
    "PURPLE": "Morado",
    "MORADO": "Morado",
    "BURGUNDY": "Burdeos",
    "BURDEOS": "Burdeos",
}


def columna_a_indice(letra: str) -> int:
    """Convierte letra de columna (A, B, C...) a índice 0-based."""
    letra = letra.strip().upper()
    valor = 0
    for ch in letra:
        valor = valor * 26 + (ord(ch) - ord("A") + 1)
    return valor - 1


def _bajar(url: str, timeout: int = 120) -> str:
    ultimo: BaseException | None = None
    for intento in range(3):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.read().decode("utf-8-sig")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(
                f"No se pudo descargar la hoja (HTTP {exc.code}). "
                "Verifica que el sheet esté público: "
                "Compartir → Cualquier persona con el enlace → Lector."
            ) from exc
        except (TimeoutError, urllib.error.URLError) as exc:
            ultimo = exc
            if intento < 2:
                print(f"  Reintento {intento + 2}/3 tras error de red...")
                continue
            raise RuntimeError(f"Error de conexión al descargar el sheet: {exc}") from exc
    raise RuntimeError(f"Error de conexión al descargar el sheet: {ultimo}")


def descargar_csv(spreadsheet_id: str, nombre_hoja: str) -> str:
    from urllib.parse import quote

    return _bajar(
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        f"/gviz/tq?tqx=out:csv&sheet={quote(nombre_hoja)}"
    )


def descargar_csv_por_gid(spreadsheet_id: str, gid: int) -> str:
    return _bajar(
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        f"/export?format=csv&gid={gid}"
    )


def descargar_hoja_inventario(spreadsheet_id: str = SPREADSHEET_ID) -> str:
    # /export entrega la hoja completa. /gviz/tq respeta los filtros activos del
    # Sheet, asi que con un filtro puesto solo devolvia las filas visibles y la
    # importacion habria borrado casi todo el catalogo.
    try:
        return descargar_csv_por_gid(spreadsheet_id, GID_INVENTARIO)
    except RuntimeError:
        pass
    try:
        return descargar_csv(spreadsheet_id, HOJA_INVENTARIO)
    except RuntimeError:
        return descargar_csv(spreadsheet_id, HOJA_INVENTARIO_LEGACY)


def carpeta_imagen_por_segmento(valor_segmento: str) -> str:
    return "mujer" if normalizar_segmento(valor_segmento) == "Mujer" else "hombre"


def url_imagen_publica(carpeta: str, numero_imagen: int, raiz: Path, base_url: str = BASE_URL_IMAGENES) -> str:
    extensiones = (".webp", ".png", ".jpg", ".jpeg")
    carpeta_path = raiz / carpeta
    for ext in extensiones:
        if (carpeta_path / f"{numero_imagen}{ext}").exists():
            return f"{base_url.rstrip('/')}/{carpeta}/{numero_imagen}{ext}"
    return f"{base_url.rstrip('/')}/{carpeta}/{numero_imagen}.webp"


def formula_imagen_celda(url: str) -> str:
    url_segura = str(url).replace('"', '""')
    return f'=IMAGE("{url_segura}", 1)'


def url_imagen_vista_sheet(url: str, ancho: int = 200) -> str:
    """URL en JPG para vista previa en Google Sheets (no admite WebP)."""
    from urllib.parse import quote

    if not url:
        return ""
    path = url.split("?", 1)[0].lower()
    if path.endswith((".png", ".jpg", ".jpeg", ".gif")):
        return url
    host_path = url.replace("https://", "").replace("http://", "")
    return f"https://images.weserv.nl/?url={quote(host_path, safe='')}&w={ancho}&output=jpg"


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


def parsear_mayoreo(valor: str) -> bool:
    clave = str(valor or "").strip().lower().replace("í", "i")
    return clave in ("si", "yes", "1", "true")


def parsear_precio_oferta_semanal(valor: str) -> float:
    return parsear_precio(valor)


def parsear_numero_imagen(valor: str) -> int | None:
    texto = str(valor or "").strip()
    if not texto or not texto.isdigit():
        return None
    numero = int(texto)
    return numero if numero > 0 else None


def elegir_numero_imagen(
    imagen_num: int | None,
    nuevo_id: int,
    numeros_usados: set[int],
) -> int:
    if imagen_num is not None:
        numero = imagen_num
    else:
        numero = nuevo_id
        while numero in numeros_usados:
            numero += 1
    numeros_usados.add(numero)
    return numero


def normalizar_coleccion(valor: str) -> str:
    texto = re.sub(r"\s+", " ", str(valor or "").strip()).upper()
    alias = {
        "GOLD'S GYM": "GOLDS GYM",
        "GOLDS": "GOLDS GYM",
        "GOLD GYM": "GOLDS GYM",
    }
    return alias.get(texto, texto)


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


def normalizar_segmento(valor: str) -> str:
    clave = re.sub(r"\s+", " ", str(valor or "").strip()).upper()
    if clave in {"MUJER", "WOMAN", "WOMEN", "FEMENINO", "F"}:
        return "Mujer"
    return "Hombre"


def hoja_usa_columna_segmento(filas: list[list[str]], idx: dict[str, int]) -> bool:
    indice = idx["segmento"]
    for fila in filas[FILA_INICIO_DATOS - 1 :]:
        if not obtener_valor(fila, idx["nombre"]):
            continue
        if obtener_valor(fila, indice):
            return True
    return False


def debe_filtrar_por_segmento(nombre_hoja: str, filas: list[list[str]], idx: dict[str, int]) -> bool:
    if nombre_hoja.strip().upper() != HOJA_INVENTARIO:
        return False
    return hoja_usa_columna_segmento(filas, idx)


def normalizar_mes_texto_stock(mes_raw: str) -> int | None:
    mes_texto = re.sub(r"\s+", " ", str(mes_raw or "").strip().lower()).replace(".", "")
    mes_texto = (
        mes_texto.replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u")
    )
    if mes_texto in MESES_FECHA_STOCK:
        return MESES_FECHA_STOCK[mes_texto]
    clave = mes_texto[:3]
    return MESES_FECHA_STOCK.get(clave)


def parsear_fecha_stock(valor: str) -> str:
    texto = str(valor or "").strip()
    if not texto or texto.upper() == "NA":
        return ""

    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", texto)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    def dmy_texto(partes: re.Match[str]) -> str:
        mes = normalizar_mes_texto_stock(partes.group(2))
        if mes is None:
            return ""
        anio = int(partes.group(3))
        if anio < 100:
            anio += 2000
        return f"{anio:04d}-{mes + 1:02d}-{int(partes.group(1)):02d}"

    for patron in (
        r"^(\d{1,2})[-/\s]([a-zA-Z]{3,})[-/\s](\d{4})$",
        r"^(\d{1,2})[-/\s]([a-zA-Z]{3,})[-/\s](\d{2})$",
    ):
        hit = re.match(patron, texto, re.I)
        if hit:
            iso = dmy_texto(hit)
            if iso:
                return iso

    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$", texto)
    if m:
        d, mes, anio = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if anio < 100:
            anio += 2000
        return f"{anio:04d}-{mes:02d}-{d:02d}"

    m = re.match(r"^(\d{1,2})\s+de\s+([a-zA-Záéíóúñ]+)\s+de\s+(\d{2,4})$", texto, re.I)
    if m:
        mes = normalizar_mes_texto_stock(m.group(2))
        if mes is not None:
            anio = int(m.group(3))
            if anio < 100:
                anio += 2000
            return f"{anio:04d}-{mes + 1:02d}-{int(m.group(1)):02d}"

    return ""


def inferir_categoria_desde_ubicacion(fila: list[str], idx: dict[str, int]) -> str:
    ubicacion = obtener_valor(fila, idx.get("ubicacion", -1)).lower()
    if "mujer" in ubicacion:
        return "Mujer"
    if "hombre" in ubicacion:
        return "Hombre"
    return ""


EXTENSIONES_IMAGEN_LOCAL = (".webp", ".png", ".jpg", ".jpeg")


def carpeta_tiene_imagen_producto(raiz: Path, carpeta: str, numero: int) -> bool:
    directorio = raiz / carpeta
    if not directorio.is_dir():
        return False
    for ext in EXTENSIONES_IMAGEN_LOCAL:
        if (directorio / f"{numero}{ext}").is_file():
            return True
        if (directorio / f"{numero}.1{ext}").is_file():
            return True
    return False


def inferir_categoria_sin_segmento(
    fila: list[str],
    idx: dict[str, int],
    raiz: Path,
) -> str:
    """Cuando la columna T (género) está vacía: ubicación AB, luego carpeta de fotos."""
    inferida = inferir_categoria_desde_ubicacion(fila, idx)
    if inferida:
        return inferida
    numero = parsear_numero_imagen(obtener_valor(fila, idx["imagen"]))
    if numero is not None:
        en_hombre = carpeta_tiene_imagen_producto(raiz, "hombre", numero)
        en_mujer = carpeta_tiene_imagen_producto(raiz, "mujer", numero)
        if en_hombre and not en_mujer:
            return "Hombre"
        if en_mujer and not en_hombre:
            return "Mujer"
    return "Hombre"


def fila_pertenece_categoria(
    fila: list[str],
    idx: dict[str, int],
    categoria: str,
    usar_segmento: bool,
    raiz: Path | None = None,
) -> bool:
    seg = obtener_valor(fila, idx["segmento"])
    if seg:
        return normalizar_segmento(seg) == categoria
    if not usar_segmento:
        return True
    if raiz is None:
        raiz = Path(__file__).resolve().parent.parent
    asignada = inferir_categoria_sin_segmento(fila, idx, raiz)
    return asignada == categoria


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


def resolver_imagenes(carpeta: Path, carpeta_rel: str, numero_imagen: int) -> tuple[str, str]:
    extensiones = (".webp", ".png", ".jpg", ".jpeg")

    def buscar(sufijo: str) -> str:
        for ext in extensiones:
            if (carpeta / f"{numero_imagen}{sufijo}{ext}").exists():
                return f"{carpeta_rel}/{numero_imagen}{sufijo}{ext}"
        return ""

    img1 = buscar("")
    img2 = buscar(".1")
    if not img1:
        img1 = f"{carpeta_rel}/{numero_imagen}.webp"
    if not img2:
        img2 = f"{carpeta_rel}/{numero_imagen}.1.webp"
    return img1, img2


def leer_productos_desde_csv(
    csv_texto: str,
    categoria: str,
    carpeta_imagenes: Path,
    carpeta_rel: str,
    nombre_hoja: str = HOJA_INVENTARIO,
) -> list[dict]:
    filas = list(csv.reader(io.StringIO(csv_texto)))
    if len(filas) < FILA_INICIO_DATOS:
        raise RuntimeError("La hoja no tiene suficientes filas.")

    idx = {nombre: columna_a_indice(letra) for nombre, letra in COLUMNAS.items()}
    usar_segmento = debe_filtrar_por_segmento(nombre_hoja, filas, idx)
    productos: list[dict] = []
    omitidos = 0
    omitidos_segmento = 0
    nuevo_id = 1
    numeros_imagen_usados: set[int] = set()

    for num_fila, fila in enumerate(filas[FILA_INICIO_DATOS - 1 :], start=FILA_INICIO_DATOS):
        nombre = obtener_valor(fila, idx["nombre"])
        stock = parsear_stock(obtener_valor(fila, idx["stock"]))

        if not nombre:
            continue
        if not fila_pertenece_categoria(
            fila, idx, categoria, usar_segmento, raiz=carpeta_imagenes.parent
        ):
            omitidos_segmento += 1
            continue
        talla_raw = obtener_valor(fila, idx["talla"])
        precio = parsear_precio(obtener_valor(fila, idx["precio"]))
        precio_mayoreo = parsear_precio(obtener_valor(fila, idx["precio_mayoreo"]))
        mayoreo = parsear_mayoreo(obtener_valor(fila, idx["mayoreo"]))
        precio_oferta_semanal = parsear_precio_oferta_semanal(
            obtener_valor(fila, idx["oferta_semanal"])
        )
        if precio <= 0:
            print(f"  [!] Fila {num_fila}: '{nombre}' sin precio válido, se omite.")
            omitidos += 1
            continue

        fecha_stock = parsear_fecha_stock(obtener_valor(fila, idx["fecha_stock"]))

        imagen_num = parsear_numero_imagen(obtener_valor(fila, idx["imagen"]))
        ref_imagen = elegir_numero_imagen(imagen_num, nuevo_id, numeros_imagen_usados)
        imagen1, imagen2 = resolver_imagenes(carpeta_imagenes, carpeta_rel, ref_imagen)
        carrusel_raw = obtener_valor(fila, idx["carrusel"])
        posicion_carrusel = 0
        if carrusel_raw.isdigit():
            n = int(carrusel_raw)
            if 1 <= n <= 8:
                posicion_carrusel = n

        productos.append(
            {
                # El id es el numero de la columna A del Sheet, no un consecutivo:
                # asi cada producto conserva su identidad entre importaciones y
                # coincide con el nombre de su foto.
                "id": ref_imagen,
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
                "precioMayoreo": precio_mayoreo,
                "mayoreo": mayoreo,
                "posicionCarrusel": posicion_carrusel,
                "coleccion": normalizar_coleccion(obtener_valor(fila, idx["coleccion"])),
                "precioOfertaSemanal": round(precio_oferta_semanal, 2)
                if precio_oferta_semanal > 0
                else 0,
                "fechaStock": fecha_stock,
            }
        )
        productos[-1]["coleccionCatalogo"] = productos[-1]["coleccion"]
        nuevo_id += 1

    if omitidos_segmento:
        print(f"  Filas de otra categoría (columna T): {omitidos_segmento}")
    print(f"  Filas omitidas (sin stock o sin datos): {omitidos}")

    # Dos filas con el mismo numero en la columna A darian dos productos con el
    # mismo id y la ficha de detalle solo encontraria el primero.
    conteo = Counter(p["id"] for p in productos)
    repetidos = sorted(num for num, veces in conteo.items() if veces > 1)
    if repetidos:
        print(f"  [!] Números repetidos en la columna A: {', '.join(map(str, repetidos))}")

    return productos


def producto_a_js(producto: dict, indent: str = "    ") -> str:
    campos = [
        ("id", producto["id"], "num"),
        ("nombre", producto["nombre"], "str"),
        ("categoria", producto["categoria"], "str"),
        ("precio", f"{producto['precio']:.2f}", "num"),
        ("stock", producto["stock"], "num"),
        ("imagen1", producto["imagen1"], "str"),
        ("imagen2", producto["imagen2"], "str"),
        ("talla", producto["talla"], "str"),
        ("tallaBase", producto["tallaBase"], "str"),
        ("tipo", producto["tipo"], "str"),
        ("color", producto["color"], "str"),
        ("marca", producto["marca"], "str"),
        ("precioMayoreo", f"{producto.get('precioMayoreo', 0):.2f}", "num"),
        ("mayoreo", producto.get("mayoreo", False), "bool"),
        ("posicionCarrusel", producto.get("posicionCarrusel", 0), "num"),
        ("coleccion", producto.get("coleccion", ""), "str"),
        (
            "precioOfertaSemanal",
            f"{float(producto.get('precioOfertaSemanal', 0) or 0):.2f}",
            "num",
        ),
        ("coleccionCatalogo", producto.get("coleccionCatalogo", producto.get("coleccion", "")), "str"),
        ("fechaStock", producto.get("fechaStock", ""), "str"),
    ]

    lineas = [f"{indent}{{"]
    for i, (clave, valor, tipo) in enumerate(campos):
        coma = "," if i < len(campos) - 1 else ""
        if tipo == "str":
            valor_js = json.dumps(valor, ensure_ascii=False)
            lineas.append(f'{indent}    {clave}: {valor_js}{coma}')
        elif tipo == "bool":
            lineas.append(f"{indent}    {clave}: {'true' if valor else 'false'}{coma}")
        else:
            lineas.append(f"{indent}    {clave}: {valor}{coma}")
    lineas.append(f"{indent}}}")
    return "\n".join(lineas)


def generar_archivo_js(productos: list[dict], variable_js: str, categoria: str) -> str:
    bloques = ",\n".join(producto_a_js(p) for p in productos)
    return f"""// =============================================================================
// STOCK {categoria.upper()} — Generado automáticamente con scripts/importar-stock.py
// Fuente: Google Sheets (hoja {HOJA_INVENTARIO}, columna T = HOMBRE/MUJER)
// Edita el sheet y vuelve a ejecutar el script para actualizar.
// =============================================================================
const {variable_js} = [
{bloques}
];
"""


def filas_sin_categoria_en_catalogo(
    csv_texto: str,
    raiz: Path,
    nombre_hoja: str = HOJA_INVENTARIO,
) -> list[dict]:
    """Filas con nombre y precio que no entrarían ni en hombre ni en mujer."""
    filas = list(csv.reader(io.StringIO(csv_texto)))
    idx = {nombre: columna_a_indice(letra) for nombre, letra in COLUMNAS.items()}
    usar_segmento = debe_filtrar_por_segmento(nombre_hoja, filas, idx)
    perdidas: list[dict] = []
    for num_fila, fila in enumerate(filas[FILA_INICIO_DATOS - 1 :], start=FILA_INICIO_DATOS):
        nombre = obtener_valor(fila, idx["nombre"])
        if not nombre:
            continue
        if parsear_precio(obtener_valor(fila, idx["precio"])) <= 0:
            continue
        en_h = fila_pertenece_categoria(fila, idx, "Hombre", usar_segmento, raiz=raiz)
        en_m = fila_pertenece_categoria(fila, idx, "Mujer", usar_segmento, raiz=raiz)
        if not en_h and not en_m:
            ref = obtener_valor(fila, idx["imagen"]).strip() or "?"
            perdidas.append({"fila": num_fila, "ref": ref, "nombre": nombre})
    return perdidas


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
    if nombre_hoja == HOJA_INVENTARIO:
        csv_texto = descargar_hoja_inventario(SPREADSHEET_ID)
    else:
        try:
            csv_texto = descargar_csv(SPREADSHEET_ID, nombre_hoja)
        except RuntimeError:
            print(f"  No se encontró '{nombre_hoja}', probando '{HOJA_INVENTARIO_LEGACY}'...")
            csv_texto = descargar_csv(SPREADSHEET_ID, HOJA_INVENTARIO_LEGACY)
            nombre_hoja = HOJA_INVENTARIO_LEGACY

    print("Procesando filas...")
    productos = leer_productos_desde_csv(
        csv_texto,
        config["categoria"],
        carpeta_img,
        config["carpeta_imagenes"],
        nombre_hoja,
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
    sin_cat = filas_sin_categoria_en_catalogo(csv_texto, raiz, nombre_hoja)
    if sin_cat:
        print(f"  [!] {len(sin_cat)} fila(s) del sheet no entran en Hombre ni Mujer (revisa T/AB/fotos):")
        for item in sin_cat[:15]:
            print(f"      fila {item['fila']} A={item['ref']} — {item['nombre'][:50]}")
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
