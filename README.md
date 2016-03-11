# Expressions.js

Expressions.js takes a string of simple JavaScript (one-liners, no blocks) and converts it into a function to be used by
JavaScript frameworks. It allows exceptions in your code to bubble up while still handling nulls gracefully. And it
supports formatters (also called filters in some frameworks) to alter the results.

## Usage

### Basic

To install Expressions.js you can use npm.

```
npm install expressions-js
```

`parse(expr)` will return a function that can be executed against any context and will return the results.

```js
var user = { name: 'Jacob' };
var product = { name: 'Toothbrush' };

// Getting data
var getName = expressions.parse('name');

var usersName = getName.call(user); // Jacob
var productsName = getName.call(product); // Toothbrush
```

`parseSetter(expr)` will return a function that sets the given value against the called context.

```js
var setName = expressions.parseSetter('name');

setName.call(user, 'Jac');
console.log(user.name); // Jac
```

### Robust expression support

All of the following are valid expressions. The rule of thumb is if it can be put on one line as a `return` statement
it is supported.

```js
expressions.parse('user.name');

expressions.parse('user.firstName + " " + user.lastName');

expressions.parse('user.name.toUpperCase()');

expressions.parse('user[prop]');

expressions.parse('getUser(userId).name');

expressions.parse('user[prop] ? "result 1" : "result 2"');

expressions.parse('user.isAdmin && user.isLoggedIn() || (prop.thing && foo.bar)');

expressions.parse('index % 2');

expressions.parse('Math.round(document.wordCount /100) * 100');

expressions.parse('foo and bar or foobar'); // and/or replaced with && and ||
```

The full available arguments for `parse` and `parseSetter` are as follows:

`parse(expr, globals, formatters, ...args)`

 * `expr` is a String of simple JavaScript
 * `globals` is an object whose properties will be available in the expression
 * `formatters` is an object that contains the formatting functions available to the expression
 * `args` are any additional argument names that may be passed into the expression


### Globals

Globals are an object to define global variables which should not be prefixed with `this.` (bound to the context the
expression is running in). For example, if you are using underscore.js you could use it within expressions by adding it
to `globals`. For example:
```js
var expr = expressions.parse('_.map(obj, mapper)', { "_": _ });
```

In addition, Expressions.js has some global defaults that you do not need to add:
* `window`
* `Math`
* `parseInt`
* `parseFloat`
* `isNaN`
* `Array`

These default `globals` will be merged with the `globals` object provided in `parse`. You can add to these default
globals to provide functionality to all expressions. Example:
```js
expressions.globals._ = require('underscore');
```

**Note:** "globals" do not need to be on the global scope of the browser window. They are simply globally available
within expressions. You can also use window globals by prefixing with `window` like: `window._.pluck()`. But using the
globals option is nicer than doing this. If you use `null` as the value of a global it will use the window's version.


### Formatters

Formatters allow an easy way to alter the results of the expression. Formatters are provided as an object hash of
name-function pairs.

```js
// Using formatters
var formatters = {
  upper: function(value) {
    return typeof value === 'string' ? value.toUpperCase() : value;
  }
};

var getUpperName = expressions.parse('name | upper', null, formatters);

var name = getUpperName.call(product); // TOOTHBRUSH

var setUpperName = expressions.parse('name | upper', null, formatters);

setUpperName.call(product, 'Hair Comb');

console.log(product.name); // HAIR COMB
```

Formatters provide a nice syntax for altering the value of an expression. They use the pipe `|` character like unix does
to pass values from one program into the next. Several other frameworks also use this syntax, making it familiar.
Formatters can take arguments and are formatted like a JavaScript function call. When no parameters are required, the
paranthesis are optional.

A formatter is a function that takes the value and returns a new one. It can also accept additional arguments. When a
formatter is used in a setter, an additional `setter` argument will be appended to the arguments with a `true` value.
When writing a formatter, remember to handle `null` cases. Below are a few examples of formatters and how they would be
used in an expression.

```js
var formatters = {
  lower: function(value) {
    return typeof value === 'string' ? value.toLowerCase() : value;
  }
};

var expr = expressions.parse('user.name | lower');
// var expr = expressions.parse('user.name | lower()'); // equivalent
expr.parse(context, formatters);
```

```js
formatters.filter = function(value, filterFunc) {
  return Array.isArray(value) ? value.filter(filterFunc) : value;
};

var expr = expressions.parse('users | filter(isAdmin)');
expr.parse(context, formatters);
```

In a setter a formatter's arguments will be appended by a boolean `true` value to indicate it is being used in a setter.
While many formatters will work the same both ways, some may work differently when setting vs getting. Possible example:

```js
formatters.isoDate = function(value, isSetter) {
  if (isSetter) {
    return new Date(value);
  } else {
    return value.toISOString();
  }
};
```


### Extra Arguments

Additional String arguments may be passed to `parse` in order to inject additional arguments into the expression. These
Strings will become the argument names that will be added to the expression function. `parseSetters` uses this actually
to pass the value of the setter in. Here is an example:
```js
var context = {
  add: function(a, b) {
    return a + b;
  }
};
// Adding numbers the hard way
var expr = expressions.parse('add(number1, number2)', null, null, 'number1', 'number2');
expr.call(context, 5, 6); // 11
```
Note that arguments always come after the "value" being passed in for setters (e.g.
`expr.call(context, value, arg1, arg2)`).



## How Expressions.js works

Expressions.js alters the JavaScript to make it work the way the user would expect. The functions that get created can
be a bit complex to achieve this goal, but this blackboxed complexity simplifies the user's life.

We'll start with the most basic example and work up.

```js
expressions.parse('name');
```
creates
```js
function() {
  return this.name;
}
```
```js
expressions.parseSetter('name');
```
creates
```js
function(_value_) {
  this.name = _value_;
}
```

This is the expected minimum and what most frameworks provide. But, what happens when you have deep properties such as
`user.name`? If you just use `return this.user.name` you'll get an error when the `user` property is `undefined`.

One way to deal with this is to just ignore it, but this makes it very
difficult as the user of the expression must either add checks within the expression (making it long and complex) or add
checks outside the expression (making their usefulness limited).

Another shortsighted way to deal with this is to add a
`try catch` around the expression and return `undefined` when there is an error. This solves the problem here, but
creates another problem later when trying to use your own functions in the expression like `user.getUserName()`. Suppose
we have a bug in `getUserName`, but we may never find it because the exception is being swallowed by the `try catch`
inside the expression.

We can find inspiration from CoffesScript's (and Ruby's) syntax `user?.name` where it returns undefined if `user` is not
defined. In Expressions.js, every chained property has an implicit `?` there, so you never have to worry about null
properties. But you will still get exceptions when your own code has errors in it.

```js
expressions.parse('user.name');
```
creates
```js
function() {
  var _ref1;
  return (_ref1 = this.user) == null ? void 0 : _ref1.name;
}
```
```js
expressions.parseSetter('user.name');
```
creates
```js
function(value) {
  var _ref1;
  (_ref1 = this.user) == null ? void 0 : (_ref1.name = value);
}
```

This null-checking is added to all property chains within the expression. This is harder to read, but nobody every reads
it. And it is ideal for the way we want expressions to work in templating systems and data-binding frameworks. It safely
binds to the given context, dealing gracefully with `undefined` or `null` values, while still allowing for errors to be
thrown from the user's code helping them find bugs easily.

Moving on to how globals and formatters work is much simpler. They are added to the arguments of the function and
referenced within the function from their object.

```js
var globals = { moment: require('moment') };
expression.parse('moment(friend.birthday).format()', globals);
```
creates
```js
function(_globals_) {
  var _ref1, _ref2;
  return _globals_.moment == null ? void 0 : (_ref2 = _globals_.moment((_ref1 = this.friend) == null ? void 0: _ref1.birthday)) == null ? void 0 : _ref2.format();
}
```

While the function is really starting to get hard to read, the main thing to note is that `_globals_` is passed in and
anything that is on that object is called from `_globals_` rather than `this`. Formatting is similar.

```js
expression.parse('group.members | filter(isAdmin)');
```
creates
```js
function(_formatters_) {
  var _ref1;
  return _formatters_.filter.call(this, (_ref1 = this.user) == null ? void 0 : _ref1.name, this.isAdmin);
}
```

**Note:** because `globals` uses the properties defined on the `globals` object to write the function, any properties
added to `globals` after an expression is parsed into a function will not be evaluated correctly. The parser will not
know at the time of parsing that, for example, `moment` was to be called off of `_globals_` rather than `this`. Be sure
to have all globals needed for an expression at the time it is compiled.


## Contributions and Issues

Please open a ticket for any bugs or feature requests.

Contributions are welcome. Please fork and send a pull-request.
