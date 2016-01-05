var expect = require('chai').expect;
var expressions = require('../index');
var strings = require('../src/strings');
var formatters = require('../src/formatters');
var propertyChains = require('../src/property-chains');

global.log = function() {
  var args = [].slice.call(arguments);
  args.unshift('\033[36m***');
  args.push('\033[0m');
  console.log.apply(console, args);
}


describe('Expressions.js', function() {


  describe('strings', function() {
    var expr = 'foo["bar"]', stringless, compiled = 'return foo[""]';

    describe('pullOutStrings', function() {

      it('should pull out all strings from an expression', function() {
        stringless = strings.pullOutStrings(expr);
        expect(stringless).to.equal('foo[""]');
      });

      it('should error when being called twice without putInStrings', function() {
        expect(strings.pullOutStrings.bind(null, expr)).to.throw(Error);
      });

    });

    describe('putInStrings', function() {

      it('should put strings back into an expression', function() {
        expect(strings.putInStrings(compiled)).to.equal('return foo["bar"]');
      });

      it('should error when being called twice without pullOutStrings', function() {
        expect(strings.putInStrings.bind(null, compiled)).to.throw(Error);
      });

    });
  });



  describe('formatters', function() {

    describe('parseFormatters', function() {
      var parse = formatters.parseFormatters;

      it('should parse a formatter', function() {
        expect(parse('name | upper')).to.equal('_formatters_.upper.call(this, name)');
      });

      it('should parse a formatter in a setter', function() {
        expect(parse('name = _value_ | upper')).to.equal('name = _formatters_.upper.call(this, _value_, true)');
      });

      it('should parse multiple formatters', function() {
        var expr = 'name | upper | foo()';
        var result = '_formatters_.foo.call(this, _formatters_.upper.call(this, name))';
        expect(parse(expr)).to.equal(result);
      });

      it('should parse formatters with arguments', function() {
        var expr = 'name | filter("test") | foo(bar)';
        var result = '_formatters_.foo.call(this, _formatters_.filter.call(this, name, "test"), bar)';
        expect(parse(expr)).to.equal(result);
      });

      it('should work with robust expressions', function() {
        var expr = 'name && foo.bar() + (length - one.two[three])';
        expect(parse(expr + ' | upper')).to.equal('_formatters_.upper.call(this, ' + expr + ')');
      });

      it('should not fail when an OR (||) is present', function() {
        expect(parse('foo || bar | upper')).to.equal('_formatters_.upper.call(this, foo || bar)');
      });
    });

  });


  describe('property-chains', function() {

    describe('parseExpression', function() {
      var variables = expressions.globals;
      var parse = function(expr) {
        return propertyChains.parseExpression(expr, variables);
      };

      it('should add "this." to the beginning of variables', function() {
        expect(parse('foo bar')).to.equal('this.foo this.bar');
      });

      it('should take care of null values', function() {
        expect(parse('foo.bar')).to.equal('var _ref1;\n((_ref1 = this.foo) == null ? void 0 : _ref1.bar)');
      });

      it('should not prefix keywords', function() {
        var expr = 'true and false and window or null or Math';
        var result = 'true && false && window || null || Math';
        expect(parse(expr)).to.equal(result);
      });

      it('should take care of null functions', function() {
        expect(parse('foo(bar)')).to.equal('(typeof this.foo !== \'function\' ? void 0 : this.foo(this.bar))');
      });

      it('should work with parenthesis', function() {
        expect(parse('!(foo && bar)')).to.equal('!(this.foo && this.bar)');
      });

      it('should take care of null functions with continuations', function() {
        var expr = 'foo(bar).test';
        var result = 'var _ref1;\n(typeof this.foo !== \'function\' ? void 0 : ' +
                     '(_ref1 = this.foo(this.bar)) == null ? void 0 : _ref1.test)';
        expect(parse(expr)).to.equal(result);
      });

      it('should take care of multiple null functions', function() {
        var expr = 'foo(bar).bar()';
        var result = 'var _ref1;\n(typeof this.foo !== \'function\' ? void 0 : ' +
                     '(_ref1 = this.foo(this.bar)) == null ? void 0 : typeof _ref1.bar !== \'function\' ? ' +
                     'void 0 : _ref1.bar())';
        expect(parse(expr)).to.equal(result);
      });

      it('should take care of multiple null functions', function() {
        var expr = 'foo(bar())';
        var result = '(typeof this.foo !== \'function\' ? void 0 : this.foo((typeof this.bar !== \'function\' ? ' +
                     'void 0 : this.bar())))';
        expect(parse(expr)).to.equal(result);
      });

      it('should add "this." to the beginning of variables within brackets', function() {
        expect(parse('foo[bar]')).to.equal('var _ref1;\n((_ref1 = this.foo) == null ? void 0 : _ref1[this.bar])');
      });

      it('should deal with array literals', function() {
        expect(parse('[foo, bar]')).to.equal('[this.foo, this.bar]');
      });

      it('should deal with object literals', function() {
        expect(parse('{foo: foo, bar: bar }')).to.equal('{foo: this.foo, bar: this.bar }');
      });

      it('should work with simple setters', function() {
        expect(parse('foo = _value_')).to.equal('this.foo = _value_');
      });

      it('should work with deep setters', function() {
        var expr = 'foo.bar = _value_';
        var result = 'var _ref1;\n(_ref1 = this.foo) == null ? void 0 : _ref1.bar = _value_';
        expect(parse(expr)).to.equal(result);
      });

      it('should work with setters after brackets', function() {
        var expr = 'foo[bar] = _value_';
        var result = 'var _ref1;\n(_ref1 = this.foo) == null ? void 0 : _ref1[this.bar] = _value_';
        expect(parse(expr)).to.equal(result);
      });

      it('should work with setters after functions', function() {
        var expr = 'foo(bar.abc).test = _value_';
        var result = 'var _ref1, _ref2;\ntypeof this.foo !== \'function\' ? void 0 : ' +
                     '(_ref1 = this.foo(((_ref2 = this.bar) == null ? void 0 : _ref2.abc))) == null ? ' +
                     'void 0 : _ref1.test = _value_';
        expect(parse(expr)).to.equal(result);
      });

      it('should work with setters after functions', function() {
        var expr = 'foo(bar).test = _value_';
        var result = 'var _ref1;\ntypeof this.foo !== \'function\' ? void 0 : ' +
                     '(_ref1 = this.foo(this.bar)) == null ? void 0 : _ref1.test = _value_';
        expect(parse(expr)).to.equal(result);
      });

    });
  });


  describe('expressions', function() {

    describe('parse', function() {
      var getFoo = expressions.parse('foo');
      var callFoo = expressions.parse('foo()');

      it('should return a function that will return a value', function() {
        expect(getFoo.call({ foo: 'bar' })).to.equal('bar');
      });

      it('should return undefined when there is a null error', function() {
        expect(getFoo.call({})).to.equal(undefined);
      });

      it('should cache functions for the same expression', function() {
        expect(expressions.parse('zxcf')).to.equal(expressions.parse('zxcf'));
      });

      it('should call a function', function() {
        expect(callFoo.call({ foo: function() { return 'bar'; }})).to.equal('bar');
      });

      it('should not fail when a function does not exist', function() {
        expect(callFoo.call({})).to.equal(undefined);
      });
    });


    describe('parseSetter', function() {
      var setFoo = expressions.parseSetter('foo');
      var setDeepFoo = expressions.parseSetter('foo.bar');
      var callFoo = expressions.parseSetter('foo().bar');

      it('should return a function that will set a value', function() {
        var obj = { foo: 'bar' };
        setFoo.call(obj, 'bar2')
        expect(obj.foo).to.equal('bar2');
      });

      it('should return a function that will set a deep value', function() {
        var obj = { foo: {} };
        setDeepFoo.call(obj, 'bar2')
        expect(obj.foo.bar).to.equal('bar2');
      });

      it('should no-op when there is a null error', function() {
        var obj = {};
        setDeepFoo.call(obj, 'bar2')
        expect(Object.keys(obj).length).to.equal(0);
      });

      it('should cache functions for the same expression', function() {
        expect(expressions.parseSetter('qwer')).to.equal(expressions.parseSetter('qwer'));
      });

      it('should not mix the getter cache with the setter cache', function() {
        expect(expressions.parseSetter('foo')).to.not.equal(expressions.parse('foo'));
      });

      it('should set a property after a function call', function() {
        var obj = {
          foo: function() {
            return this.foobar
          },
          foobar: {}
        };
        callFoo.call(obj, 'testing');
        expect(obj.foobar.bar).to.equal('testing');
      });

      it('should not fail when a function does not exist', function() {
        expect(callFoo.bind({})).to.not.throw(Error);
      });


      it('should compile formatted setters correctly', function() {
        var expr = expressions.parseSetter('user.name | upper');
        var result = 'var _ref1, _ref2, _ref3;\n' +
          '(_ref1 = this.user) == null ? void 0 : _ref1.name = ' +
          '((_ref2 = _formatters_) == null ? void 0 : (_ref3 = _ref2.upper) == null ? void 0 : ' +
          'typeof _ref3.call !== \'function\' ? void 0 : _ref3.call(this, _value_, true))';
        expect(expr.expr).to.equal(result);
      });
    });

  });



});
