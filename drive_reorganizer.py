from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from rich.console import Console
from rich.table import Table

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
]

FOLDER_MIME = "application/vnd.google-apps.folder"
DOC_MIME = "application/vnd.google-apps.document"
SHEET_MIME = "application/vnd.google-apps.spreadsheet"
SLIDE_MIME = "application/vnd.google-apps.presentation"

console = Console()


def load_json(path: str | Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str | Path, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def clean_spaces(value: str) -> str:
    value = re.sub(r"[\u200b\ufeff]", "", value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def strip_emojis(value: str) -> str:
    return re.sub(r"[^\w\s,()./&+-À-ÿ]", "", value or "")


def normalize_asciiish(value: str) -> str:
    replacements = {
        "ç": "c", "Ç": "C", "ã": "a", "Ã": "A", "á": "a", "Á": "A", "à": "a", "À": "A",
        "â": "a", "Â": "A", "é": "e", "É": "E", "ê": "e", "Ê": "E", "í": "i", "Í": "I",
        "ó": "o", "Ó": "O", "ô": "o", "Ô": "O", "õ": "o", "Õ": "O", "ú": "u", "Ú": "U",
    }
    for k, v in replacements.items():
        value = value.replace(k, v)
    return value


def safe_name(value: str, *, model: bool = False, replacements: Optional[Dict[str, str]] = None) -> str:
    value = clean_spaces(strip_emojis(value))
    value = value.replace("_", " ")
    value = re.sub(r"\.(xlsx|xls|docx|doc|pdf|pptx|ppt)$", "", value, flags=re.I)
    value = re.sub(r"^\d{1,3}\s*[-. )]+\s*", "", value)
    if model and replacements:
        for old, new in replacements.items():
            value = re.sub(re.escape(old), new, value, flags=re.I)
    value = clean_spaces(value)
    if model:
        value = normalize_asciiish(value)
    value = re.sub(r"\s{2,}", " ", value).strip(" -_.")
    return value or "Arquivo sem nome"


def is_unit_folder(name: str, unit_terms: Iterable[str]) -> bool:
    low = normalize_asciiish(name).lower()
    return any(normalize_asciiish(term).lower() in low for term in unit_terms)


def map_model_folder(name: str, folder_map: Dict[str, str], replacements: Dict[str, str]) -> str:
    raw = safe_name(name, model=True, replacements=replacements)
    raw_low = normalize_asciiish(raw).lower()
    for key, mapped in folder_map.items():
        key_low = normalize_asciiish(key).lower()
        if key_low and key_low in raw_low:
            return safe_name(mapped, model=True, replacements=replacements)
    return raw


@dataclass
class CopyItem:
    source_id: str
    source_name: str
    source_mime: str
    dest_id: Optional[str]
    dest_name: Optional[str]
    mode: str
    status: str
    note: str = ""


@dataclass
class RunState:
    copied: List[CopyItem] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    folders: Dict[Tuple[str, str], str] = field(default_factory=dict)

    def log_copy(self, **kwargs: Any) -> None:
        self.copied.append(CopyItem(**kwargs))

    def log_error(self, context: str, error: Exception | str, data: Optional[dict] = None) -> None:
        self.errors.append({"context": context, "error": str(error), "data": data or {}})


class GoogleClients:
    def __init__(self, credentials_path: str, token_path: str):
        creds = self._authorize(credentials_path, token_path)
        self.drive = build("drive", "v3", credentials=creds)
        self.sheets = build("sheets", "v4", credentials=creds)
        self.docs = build("docs", "v1", credentials=creds)

    def _authorize(self, credentials_path: str, token_path: str) -> Credentials:
        creds = None
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(token_path, "w", encoding="utf-8") as token:
                token.write(creds.to_json())
        return creds


class DriveReorganizer:
    def __init__(self, cfg: dict, clients: GoogleClients, execute: bool = False):
        self.cfg = cfg
        self.clients = clients
        self.execute = execute
        self.state = RunState()
        self.replacements = cfg.get("neutral_replacements", {})
        self.folder_map = cfg.get("model_folder_map", {})
        self.unit_terms = cfg.get("unit_folder_names", [])

    def run(self) -> dict:
        base = self.resolve_base_folder()
        parent_id = self.cfg.get("output_parent_id") or (base.get("parents") or ["root"])[0]

        console.print(f"Base: {base['name']} [{base['id']}]")
        console.print(f"Destino pai: {parent_id}")
        console.print("Modo: " + ("EXECUCAO REAL" if self.execute else "SIMULACAO"))

        current_root_id = None
        model_root_id = None
        archive_id = None

        if self.cfg.get("copy_current_exact", True):
            current_root_id = self.ensure_folder(parent_id, self.cfg.get("current_folder_name", "Sistema Operacional Atual"))
            self.copy_tree_current(base["id"], current_root_id, path=[base["name"]])

        if self.cfg.get("copy_model_neutral", True):
            model_root_id = self.ensure_folder(parent_id, self.cfg.get("model_folder_name", "Sistema Operacional Modelo"))
            self.copy_tree_model(base["id"], model_root_id, path=[base["name"]])
            if self.cfg.get("create_missing_pops", True):
                self.create_missing_pops_doc(model_root_id, model=True)

        if self.cfg.get("create_archive_folder", True):
            archive_id = self.ensure_folder(parent_id, self.cfg.get("archive_folder_name", "excluir"))

        if self.cfg.get("protect_sheets", True) and self.execute:
            self.apply_sheet_protections()

        report = {
            "base": base,
            "current_root_id": current_root_id,
            "model_root_id": model_root_id,
            "archive_folder_id": archive_id,
            "execute": self.execute,
            "copied": [item.__dict__ for item in self.state.copied],
            "errors": self.state.errors,
        }
        return report

    def resolve_base_folder(self) -> dict:
        folder_id = self.cfg.get("base_folder_id")
        if folder_id and not folder_id.startswith("COLE_AQUI"):
            return self.get_file(folder_id)
        name = self.cfg.get("base_folder_name", "Sala D'Oro")
        q = (
            f"mimeType='{FOLDER_MIME}' and trashed=false and "
            f"name contains '{name.replace(chr(39), chr(92)+chr(39))}'"
        )
        results = self.list_query(q, page_size=10)
        if not results:
            raise RuntimeError(f"Pasta base nao encontrada: {name}")
        if len(results) > 1:
            console.print("Mais de uma pasta candidata encontrada. Usando a primeira:")
            for f in results:
                console.print(f"- {f['name']} [{f['id']}]")
        return results[0]

    def get_file(self, file_id: str) -> dict:
        return self.clients.drive.files().get(
            fileId=file_id,
            fields="id,name,mimeType,parents,webViewLink,modifiedTime",
            supportsAllDrives=True,
        ).execute()

    def list_children(self, folder_id: str) -> List[dict]:
        q = f"'{folder_id}' in parents and trashed=false"
        return self.list_query(q, page_size=1000)

    def list_query(self, q: str, page_size: int = 1000) -> List[dict]:
        items = []
        page_token = None
        while True:
            resp = self.clients.drive.files().list(
                q=q,
                fields="nextPageToken, files(id,name,mimeType,parents,webViewLink,modifiedTime)",
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                corpora="allDrives",
                pageSize=page_size,
                pageToken=page_token,
            ).execute()
            items.extend(resp.get("files", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return items

    def ensure_folder(self, parent_id: str, name: str) -> str:
        name = safe_name(name)
        key = (parent_id, name)
        if key in self.state.folders:
            return self.state.folders[key]
        q = (
            f"'{parent_id}' in parents and trashed=false and "
            f"mimeType='{FOLDER_MIME}' and name='{name.replace(chr(39), chr(92)+chr(39))}'"
        )
        existing = self.list_query(q, page_size=10)
        if existing:
            folder_id = existing[0]["id"]
            self.state.folders[key] = folder_id
            return folder_id
        if not self.execute:
            fake_id = f"SIMULADO_{len(self.state.folders)+1}_{re.sub(r'[^A-Za-z0-9]+', '_', name)}"
            self.state.folders[key] = fake_id
            self.state.log_copy(
                source_id=parent_id,
                source_name="",
                source_mime=FOLDER_MIME,
                dest_id=fake_id,
                dest_name=name,
                mode="folder",
                status="simulado",
                note="criaria pasta",
            )
            return fake_id
        meta = {"name": name, "mimeType": FOLDER_MIME, "parents": [parent_id]}
        created = self.clients.drive.files().create(body=meta, fields="id,name,webViewLink", supportsAllDrives=True).execute()
        folder_id = created["id"]
        self.state.folders[key] = folder_id
        self.state.log_copy(
            source_id=parent_id,
            source_name="",
            source_mime=FOLDER_MIME,
            dest_id=folder_id,
            dest_name=name,
            mode="folder",
            status="criado",
            note=created.get("webViewLink", ""),
        )
        return folder_id

    def copy_tree_current(self, source_folder_id: str, dest_folder_id: str, path: List[str]) -> None:
        for child in self.list_children(source_folder_id):
            try:
                name = safe_name(child["name"])
                if child["mimeType"] == FOLDER_MIME:
                    new_folder = self.ensure_folder(dest_folder_id, name)
                    self.copy_tree_current(child["id"], new_folder, path + [name])
                else:
                    new_id = self.copy_file(child, dest_folder_id, name, mode="current")
                    if self.cfg.get("create_missing_pops", True) and child["mimeType"] == SHEET_MIME:
                        pass
            except Exception as e:
                self.state.log_error("copy_tree_current", e, child)

    def copy_tree_model(self, source_folder_id: str, model_root_id: str, path: List[str]) -> None:
        for child in self.list_children(source_folder_id):
            try:
                raw_name = child["name"]
                if child["mimeType"] == FOLDER_MIME:
                    if is_unit_folder(raw_name, self.unit_terms):
                        self.copy_tree_model(child["id"], model_root_id, path + [raw_name])
                        continue
                    mapped = map_model_folder(raw_name, self.folder_map, self.replacements)
                    new_folder = self.ensure_folder(model_root_id, mapped)
                    self.copy_tree_model(child["id"], new_folder, path + [mapped])
                else:
                    name = safe_name(raw_name, model=True, replacements=self.replacements)
                    new_id = self.copy_file(child, model_root_id, name, mode="model")
                    self.neutralize_content(new_id, child["mimeType"], model=True)
            except Exception as e:
                self.state.log_error("copy_tree_model", e, child)

    def copy_file(self, source: dict, dest_parent_id: str, new_name: str, mode: str) -> Optional[str]:
        if not self.execute:
            fake_id = f"SIMULADO_FILE_{source['id']}"
            self.state.log_copy(
                source_id=source["id"],
                source_name=source["name"],
                source_mime=source["mimeType"],
                dest_id=fake_id,
                dest_name=new_name,
                mode=mode,
                status="simulado",
                note="copiaria arquivo",
            )
            return fake_id
        body = {"name": new_name, "parents": [dest_parent_id]}
        copied = self.clients.drive.files().copy(
            fileId=source["id"],
            body=body,
            fields="id,name,mimeType,webViewLink",
            supportsAllDrives=True,
        ).execute()
        self.state.log_copy(
            source_id=source["id"],
            source_name=source["name"],
            source_mime=source["mimeType"],
            dest_id=copied["id"],
            dest_name=copied["name"],
            mode=mode,
            status="copiado",
            note=copied.get("webViewLink", ""),
        )
        return copied["id"]

    def neutralize_content(self, file_id: Optional[str], mime_type: str, model: bool) -> None:
        if not file_id or not self.execute or not model:
            return
        if mime_type == DOC_MIME:
            self.replace_text_in_doc(file_id)
        elif mime_type == SHEET_MIME:
            self.replace_text_in_sheet(file_id)

    def replace_text_in_doc(self, doc_id: str) -> None:
        requests = []
        for old, new in self.replacements.items():
            requests.append({
                "replaceAllText": {
                    "containsText": {"text": old, "matchCase": False},
                    "replaceText": new,
                }
            })
        if requests:
            self.clients.docs.documents().batchUpdate(documentId=doc_id, body={"requests": requests}).execute()

    def replace_text_in_sheet(self, spreadsheet_id: str) -> None:
        requests = []
        for old, new in self.replacements.items():
            requests.append({
                "findReplace": {
                    "find": old,
                    "replacement": new,
                    "allSheets": True,
                    "matchCase": False,
                }
            })
        if requests:
            self.clients.sheets.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={"requests": requests},
            ).execute()

    def apply_sheet_protections(self) -> None:
        sheet_ids = [item.dest_id for item in self.state.copied if item.dest_id and item.source_mime == SHEET_MIME]
        for spreadsheet_id in sheet_ids:
            try:
                self.protect_spreadsheet(spreadsheet_id)
            except Exception as e:
                self.state.log_error("protect_spreadsheet", e, {"spreadsheet_id": spreadsheet_id})

    def protect_spreadsheet(self, spreadsheet_id: str) -> None:
        meta = self.clients.sheets.spreadsheets().get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
        ).execute()
        requests = []
        editable_headers = {normalize_asciiish(h).lower() for h in self.cfg.get("editable_headers", [])}
        editor_emails = list(dict.fromkeys(self.cfg.get("team_editor_emails", []) + self.cfg.get("manager_editor_emails", [])))

        for sheet in meta.get("sheets", []):
            props = sheet["properties"]
            sheet_id = props["sheetId"]
            row_count = props.get("gridProperties", {}).get("rowCount", 1000)
            col_count = props.get("gridProperties", {}).get("columnCount", 26)
            unprotected = self._unprotected_ranges_by_header(spreadsheet_id, props["title"], sheet_id, col_count, editable_headers)
            protected_range = {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": row_count,
                    "startColumnIndex": 0,
                    "endColumnIndex": col_count,
                },
                "description": "Protecao automatica: manter formulas, cabecalhos e indicadores preservados",
                "warningOnly": False if editor_emails else True,
                "unprotectedRanges": unprotected,
            }
            if editor_emails:
                protected_range["editors"] = {"users": editor_emails}
            requests.append({"addProtectedRange": {"protectedRange": protected_range}})
        if requests:
            self.clients.sheets.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()

    def _unprotected_ranges_by_header(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        sheet_id: int,
        col_count: int,
        editable_headers: set[str],
    ) -> List[dict]:
        try:
            range_name = f"'{sheet_name.replace(chr(39), chr(39)+chr(39))}'!1:3"
            values = self.clients.sheets.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueRenderOption="FORMATTED_VALUE",
            ).execute().get("values", [])
        except HttpError:
            return []
        header_row = None
        for row_idx, row in enumerate(values[:3]):
            normalized = [normalize_asciiish(str(cell)).lower().strip() for cell in row]
            if any(cell in editable_headers for cell in normalized):
                header_row = row
                break
        if not header_row:
            return []
        ranges = []
        for col_idx, cell in enumerate(header_row[:col_count]):
            if normalize_asciiish(str(cell)).lower().strip() in editable_headers:
                ranges.append({
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "startColumnIndex": col_idx,
                    "endColumnIndex": col_idx + 1,
                })
        return ranges

    def create_missing_pops_doc(self, parent_id: str, model: bool = True) -> Optional[str]:
        title = "POPs Complementares"
        content = build_pops_content()
        if not self.execute:
            self.state.log_copy(
                source_id=parent_id,
                source_name="",
                source_mime=DOC_MIME,
                dest_id="SIMULADO_DOC_POPS",
                dest_name=title,
                mode="model",
                status="simulado",
                note="criaria documento de POPs complementares",
            )
            return None
        meta = {"name": title, "mimeType": DOC_MIME, "parents": [parent_id]}
        doc = self.clients.drive.files().create(body=meta, fields="id,name,webViewLink", supportsAllDrives=True).execute()
        self.clients.docs.documents().batchUpdate(
            documentId=doc["id"],
            body={"requests": [{"insertText": {"location": {"index": 1}, "text": content}}]},
        ).execute()
        self.state.log_copy(
            source_id=parent_id,
            source_name="",
            source_mime=DOC_MIME,
            dest_id=doc["id"],
            dest_name=title,
            mode="model",
            status="criado",
            note=doc.get("webViewLink", ""),
        )
        return doc["id"]


def build_pops_content() -> str:
    pops = [
        ("Sequencia de Conversao", "Conduzir contatos comerciais de clientes em aberto ate conversao ou encerramento claro."),
        ("Pos Atendimento de Clientes Novas", "Registrar retorno da primeira visita e identificar satisfacao, duvida ou oportunidade."),
        ("Envio de Link de Avaliacao", "Enviar link apenas para cliente nova que respondeu ao Pos Atendimento com retorno positivo."),
        ("Plano de Recorrencia", "Estimular retorno planejado com base no perfil da cliente e no servico realizado."),
        ("Plano de Indicacao", "Registrar indicacoes recebidas e acompanhar conversao de novas clientes."),
        ("Reativacao de Clientes Inativas", "Recuperar clientes sem retorno recente com abordagem adequada e registrada."),
        ("Aniversariantes", "Ativar clientes no periodo de aniversario com abordagem institucional e controle de retorno."),
        ("Faltantes e Canceladas", "Recuperar oportunidades perdidas por ausencia ou cancelamento."),
        ("Recepcao Presencial", "Garantir acolhimento, direcionamento e fechamento da experiencia presencial."),
        ("Mensagem de Agradecimento Pos Visita", "Revisar ao longo do dia se a mensagem automatica padrao foi enviada para todas as clientes atendidas."),
        ("Controle de Insumos", "Manter registros de entradas, saidas, minimo, vencimento e divergencias."),
        ("Registro de Ocorrencias", "Formalizar falhas, divergencias e excecoes com responsavel e acao corretiva."),
        ("Consolidacao Diaria", "Conferir registros do dia e garantir base pronta para leitura da gestao."),
        ("Leitura de Indicadores", "Interpretar status dos indicadores e definir prioridade de acao."),
        ("Acao Corretiva", "Registrar problema, causa, acao, responsavel, prazo e resultado esperado."),
        ("Auditoria Semanal", "Verificar aderencia aos processos e registrar conformidade por area."),
        ("Briefing Mensal para Diretoria", "Preparar resumo executivo com resultado, risco, decisao e proximo passo."),
        ("Atualizacao Trimestral de Metas", "Revisar metas com base em historico real, contexto e direcao estrategica."),
        ("Comunicacao de Desvios", "Reportar desvios criticos com urgencia, clareza e responsavel definido."),
        ("Analise de Tendencias", "Comparar periodos e identificar padroes, sazonalidades e oportunidades."),
    ]
    parts = ["POPs Complementares\n\n"]
    for title, objective in pops:
        parts.append(f"{title}\n")
        parts.append(f"Objetivo: {objective}\n")
        parts.append("Frequencia: conforme rotina da funcao ou demanda operacional.\n")
        parts.append("Responsavel: equipe executora, lideranca ou gestao conforme area.\n")
        parts.append("Passo a passo:\n")
        parts.append("1. Identificar a demanda ou evento que inicia a tarefa.\n")
        parts.append("2. Conferir informacoes obrigatorias antes de registrar.\n")
        parts.append("3. Executar a acao conforme padrao definido.\n")
        parts.append("4. Registrar status, responsavel, data e observacao quando aplicavel.\n")
        parts.append("5. Encaminhar pendencia para lideranca quando houver risco, atraso ou desvio.\n")
        parts.append("Pontos criticos: clareza no registro, padronizacao da linguagem e fechamento da pendencia.\n")
        parts.append("Registro obrigatorio: planilha ou painel correspondente.\n\n")
    return "".join(parts)


def print_summary(report: dict) -> None:
    table = Table(title="Resumo da execucao")
    table.add_column("Tipo")
    table.add_column("Quantidade")
    table.add_row("Itens processados", str(len(report.get("copied", []))))
    table.add_row("Erros", str(len(report.get("errors", []))))
    table.add_row("Pasta atual", str(report.get("current_root_id")))
    table.add_row("Pasta modelo", str(report.get("model_root_id")))
    table.add_row("Pasta excluir", str(report.get("archive_folder_id")))
    console.print(table)


def main() -> int:
    parser = argparse.ArgumentParser(description="Reorganiza a pasta base em duas pastas gemeas operacionais.")
    parser.add_argument("--config", default="config.json", help="Caminho do arquivo de configuracao JSON.")
    parser.add_argument("--credentials", default="credentials.json", help="OAuth client secret do Google Cloud.")
    parser.add_argument("--token", default="token.json", help="Arquivo local de token OAuth.")
    parser.add_argument("--execute", action="store_true", help="Executa alteracoes reais no Drive. Sem isso roda simulacao.")
    parser.add_argument("--report", default="relatorio_execucao.json", help="Caminho para salvar relatorio JSON.")
    args = parser.parse_args()

    cfg = load_json(args.config)
    clients = GoogleClients(args.credentials, args.token)
    reorganizer = DriveReorganizer(cfg, clients, execute=args.execute)
    report = reorganizer.run()
    save_json(args.report, report)
    print_summary(report)
    console.print(f"Relatorio salvo em: {args.report}")
    if not args.execute:
        console.print("Simulacao concluida. Revise o relatorio. Depois rode com --execute.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
