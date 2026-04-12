// pdf-parse/index.js при !module.parent пытается прочитать ./test/data/05-versions-space.pdf.
// Загрузка через require из этого файла задаёт module.parent и отключает этот блок.
module.exports = require("pdf-parse");
