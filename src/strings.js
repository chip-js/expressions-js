// finds all quoted strings
var quoteRegex = /(['"\/])(\\\1|[^\1])*?\1/g;

// finds all empty quoted strings
var emptyQuoteExpr = /(['"\/])\1/g;

var strings = null;


/**
 * Remove strings from an expression for easier parsing. Returns a list of the strings to add back in later.
 * This method actually leaves the string quote marks but empties them of their contents. Then when replacing them after
 * parsing the contents just get put back into their quotes marks.
 */
exports.pullOutStrings = function(expr) {
  if (strings) {
    throw new Error('putInStrings must be called after pullOutStrings.');
  }

  strings = [];

  return expr.replace(quoteRegex, function(str, quote) {
    strings.push(str);
    return quote + quote; // placeholder for the string
  });
};


/**
 * Replace the strings previously pulled out after parsing is finished.
 */
exports.putInStrings = function(expr) {
  if (!strings) {
    throw new Error('pullOutStrings must be called before putInStrings.');
  }

  expr = expr.replace(emptyQuoteExpr, function() {
    return strings.shift();
  });

  strings = null;

  return expr;
};
