#!/usr/bin/env python3
"""
Vista previa en columna J (IMAGE) del Google Sheet INVENTARIO.

Usa columna A = número de foto y columna T = HOMBRE / MUJER para elegir
hombre/ vs mujer/ en GitHub Pages (no mezcla el mismo número entre géneros).

Uso:
  python scripts/actualizar-columna-j-imagenes.py --dry-run
  python scripts/actualizar-columna-j-imagenes.py --aplicar
  python scripts/actualizar-columna-j-imagenes.py --aplicar --credenciales ruta.json

Requisitos para --aplicar:
  pip install google-api-python-client google-auth
  Cuenta de servicio con acceso Editor al sheet (compartir el sheet con su email).
  JSON en scripts/google-sheets-service-account.json (local, no se sube a git).
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import io
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT_IMPORT = Path(__file__).resolve().parent / "importar-stock.py"
CRED_DEFAULT = Path(__file__).resolve().parent / "google-sheets-service-account.json"
COLUMNA_J = "J"
FILA_INICIO = 3  # fila 1 título, 2 encabezados


def _cargar_importar_stock():
    spec = importlib.util.spec_from_file_location("importar_stock", SCRIPT_IMPORT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se pudo cargar {SCRIPT_IMPORT}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["importar_stock"] = mod
    spec.loader.exec_module(mod)
    return mod


def _formulas_por_fila(imp) -> tuple[dict[int, str], list[str]]:
    csv_texto = imp.descargar_hoja_inventario(imp.SPREADSHEET_ID)
    filas = list(csv.reader(io.StringIO(csv_texto)))
    idx = {nombre: imp.columna_a_indice(letra) for nombre, letra in imp.COLUMNAS.items()}
    usar_segmento = imp.debe_filtrar_por_segmento(imp.HOJA_INVENTARIO, filas, idx)

    formulas: dict[int, str] = {}
    avisos: list[str] = []

    for num_fila, fila in enumerate(filas[FILA_INICIO - 1 :], start=FILA_INICIO):
        nombre = imp.obtener_valor(fila, idx["nombre"])
        if not nombre or nombre.upper() == "NOMBRE":
            continue
        numero = imp.parsear_numero_imagen(imp.obtener_valor(fila, idx["imagen"]))
        if numero is None:
            avisos.append(f"  Fila {num_fila}: sin número en columna A — {nombre[:40]}")
            continue

        carpeta = imp.resolver_carpeta_imagen_fila(fila, idx, RAIZ)
        seg = imp.obtener_valor(fila, idx["segmento"])
        url_pub = imp.url_imagen_publica(carpeta, numero, RAIZ)
        url_jpg = imp.url_imagen_vista_sheet(url_pub)
        formulas[num_fila] = imp.formula_imagen_celda(url_jpg)

        if usar_segmento and not seg:
            avisos.append(
                f"  Fila {num_fila}: T vacía → carpeta '{carpeta}' por ubicación/fotos (A={numero})"
            )

    return formulas, avisos


def _aplicar_en_sheet(imp, formulas: dict[int, str], credenciales: Path) -> None:
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise SystemExit(
            "Falta google-api-python-client / google-auth. "
            "Instala: pip install google-api-python-client google-auth"
        ) from exc

    if not credenciales.is_file():
        raise SystemExit(
            f"No encontré credenciales: {credenciales}\n"
            "Crea una cuenta de servicio en Google Cloud, activa Sheets API, "
            "descarga el JSON y comparte el INVENTARIO con el email de la cuenta."
        )

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(str(credenciales), scopes=scopes)
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)

    if not formulas:
        print("Nada que escribir en columna J.")
        return

    max_fila = max(formulas.keys())
    valores: list[list[str]] = []
    for fila in range(FILA_INICIO, max_fila + 1):
        valores.append([formulas.get(fila, "")])

    rango = f"{imp.HOJA_INVENTARIO}!{COLUMNA_J}{FILA_INICIO}:{COLUMNA_J}{max_fila}"
    body = {"values": valores, "majorDimension": "ROWS"}
    service.spreadsheets().values().update(
        spreadsheetId=imp.SPREADSHEET_ID,
        range=rango,
        valueInputOption="USER_ENTERED",
        body=body,
    ).execute()
    print(f"Columna J actualizada: {rango} ({len(formulas)} fórmulas IMAGE).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fórmulas IMAGE en columna J según A + T")
    parser.add_argument("--dry-run", action="store_true", help="Muestra ejemplos sin escribir")
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="Escribe fórmulas en el Google Sheet (requiere credenciales)",
    )
    parser.add_argument(
        "--credenciales",
        type=Path,
        default=CRED_DEFAULT,
        help="JSON de cuenta de servicio de Google",
    )
    parser.add_argument("--limite", type=int, default=8, help="Filas de ejemplo en --dry-run")
    args = parser.parse_args()

    imp = _cargar_importar_stock()
    print(f"Descargando '{imp.HOJA_INVENTARIO}'...")
    formulas, avisos = _formulas_por_fila(imp)
    print(f"  Filas con fórmula IMAGE: {len(formulas)}")

    if avisos:
        print("\nAvisos (primeros 15):")
        for linea in avisos[:15]:
            print(linea)
        if len(avisos) > 15:
            print(f"  ... y {len(avisos) - 15} más")

    if args.dry_run or not args.aplicar:
        print("\nEjemplos (columna J):")
        for i, (fila, f) in enumerate(sorted(formulas.items())):
            if i >= args.limite:
                print(f"  ... ({len(formulas) - args.limite} filas más)")
                break
            print(f"  Fila {fila}: {f[:90]}...")
        if not args.aplicar:
            print("\nPara escribir en el sheet: python scripts/actualizar-columna-j-imagenes.py --aplicar")
        return 0

    _aplicar_en_sheet(imp, formulas, args.credenciales)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
