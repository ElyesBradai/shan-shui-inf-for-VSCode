'use strict';
// Dependency-free VSIX packer using the standard VSIX/OPC ZIP format.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const escape = text => String(text).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const entries = new Map();
function addFolder(folder) {
  for (const item of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
    const relative = `${folder}/${item.name}`;
    if (item.isDirectory()) addFolder(relative);
    else entries.set(`extension/${relative}`, fs.readFileSync(path.join(root, relative)));
  }
}
for (const file of ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md']) entries.set(`extension/${file}`, fs.readFileSync(path.join(root, file)));
addFolder('src');
addFolder('renderer');
entries.set('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="mjs" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="vsixmanifest" ContentType="text/xml"/><Override PartName="/extension/LICENSE" ContentType="text/plain"/></Types>`));
entries.set('extension.vsixmanifest', Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
<Metadata><Identity Language="en-US" Id="${escape(manifest.name)}" Version="${escape(manifest.version)}" Publisher="${escape(manifest.publisher)}"/><DisplayName>${escape(manifest.displayName)}</DisplayName><Description xml:space="preserve">${escape(manifest.description)}</Description><Tags>${escape(manifest.keywords.join(','))}</Tags><Categories>Other</Categories><GalleryFlags>Public</GalleryFlags><License>extension/LICENSE</License><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="${escape(manifest.engines.vscode)}"/><Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui"/><Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true"/><Property Id="Microsoft.VisualStudio.Services.Links.Source" Value="${escape(manifest.repository.url)}"/></Properties></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true"/></Assets></PackageManifest>`));
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
let offset = 0;
const localParts = [], centralParts = [];
for (const [filename, data] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
  const name = Buffer.from(filename), packed = zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(33, 12); // deterministic 1980-01-01
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  localParts.push(local, name, packed);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);
  offset += local.length + name.length + packed.length;
}
const central = Buffer.concat(centralParts), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.size, 8); end.writeUInt16LE(entries.size, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const destination = path.join(root, 'artifacts', `${manifest.name}-${manifest.version}.vsix`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, Buffer.concat([...localParts, central, end]));
console.log(destination);
