'use strict';
const reader = require('../../cli/lib/evaluate/configuration-experiment');
module.exports = reader;
if (require.main === module)
  reader.main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
