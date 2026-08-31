const fs = require("fs");
const parser = require("php-parser");

const engine = new parser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

const code = fs.readFileSync("test/sample-template.php", "utf8");
const ast = engine.parseCode(code);

console.log(JSON.stringify(ast, null, 2));
