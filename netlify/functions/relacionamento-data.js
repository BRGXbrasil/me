const fs = require("node:fs");
const path = require("node:path");

const dataFile = path.join(__dirname, "..", "..", "data", "relacionamento.json");

function readData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return { executions: [], userName: "", workMode: "relacionamento" };
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers, body: JSON.stringify(readData()) };
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const current = readData();
    if (body.type === "execution" && body.payload) {
      current.executions = [body.payload, ...(current.executions || [])].slice(0, 500);
      current.userName = body.payload.userName || current.userName;
    }
    if (body.type === "settings" && body.payload) {
      current.userName = body.payload.userName || current.userName;
      current.workMode = body.payload.workMode || current.workMode;
    }
    writeData(current);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
