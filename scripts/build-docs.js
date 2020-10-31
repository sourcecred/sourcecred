// @flow
const fs = require("fs");
const path = require("path");
const jsdoc2md = require("jsdoc-to-markdown");
const chalk = require("chalk");

function success(message) {
  const label = chalk.bgGreen.bold.white(" SUCCESS ");
  console.log(`${label} ${message}`);
}

function error(message) {
  const label = chalk.bgRed.bold.white(" FAIL ");
  console.log(`${label} ${message}`);
}

// Return a list of files of the specified fileTypes in the provided dir,
// with the file path relative to the given dir
// dir: path of the directory you want to search the files for
// fileTypes: array of file types you are search files, ex: ['.txt', '.jpg']
function getFilesFromDir(dir, fileTypes) {
  var filesToReturn = [];
  function walkDir(currentPath) {
    var files = fs.readdirSync(currentPath);
    for (var i in files) {
      var curFile = path.join(currentPath, files[i]);
      if (
        fs.statSync(curFile).isFile() &&
        fileTypes.indexOf(path.extname(curFile)) != -1
      ) {
        filesToReturn.push(curFile.replace(dir, ""));
      } else if (fs.statSync(curFile).isDirectory()) {
        walkDir(curFile);
      }
    }
  }
  walkDir(dir);
  return filesToReturn;
}

async function generateDocs(inputFile) {
  /* input and output paths */
  const outputDir = "./docs";

  /* get template data */
  const templateData = jsdoc2md.getTemplateDataSync({
    files: inputFile,
    configure: "./jsdoc-conf.json",
  });

  /* reduce templateData to an array of class names */
  const classNames = templateData.reduce((classNames, identifier) => {
    if (identifier.kind === "class") classNames.push(identifier.name);
    return classNames;
  }, []);

  /* create a documentation file for each class */
  for (const className of classNames) {
    const template = `{{#class name="${className}"}}{{>docs}}{{/class}}`;
    const output = jsdoc2md.renderSync({
      data: templateData,
      template: template,
    });
    fs.writeFileSync(path.resolve(outputDir, `${className}.md`), output);
    success(`rendering ${className}`);
  }
}

getFilesFromDir("./src", [".js"]).map((fileDir) =>
  generateDocs(fileDir).catch((err) => {
    error(err);
  })
);
