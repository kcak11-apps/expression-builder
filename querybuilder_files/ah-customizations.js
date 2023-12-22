((function () {
    var QBU = {
        applyFieldPrefix: function (options) {
            if (options.filters) {
                options.filters = JSON.parse(JSON.stringify(options.filters, function (key, value) {
                    if (key === "field") {
                        if (("" + value).toLowerCase() === "group") {
                            //"group" is a reserved SQL keyword, hence prefixing it.
                            return "sspexp_" + value;
                        }
                        return value;
                    }
                    return value;
                }));
            }
        },
        restrictSpecialCharsInTextInput: function () {
            document.querySelector("#builder").addEventListener("input", function (e) {
                if (e && e.target && e.target.tagName.toLowerCase() === "input" && e.target.getAttribute("type") === "text") {
                    var updated = false;
                    var val = e.target.value;
                    if (val.indexOf("\"") > -1) {
                        val = val.split("\"").join("");
                        updated = true;
                    }
                    if (val.indexOf("\'") > -1) {
                        val = val.split("\'").join("");
                        updated = true;
                    }
                    if (val.indexOf("(") > -1) {
                        val = val.split("(").join("");
                        updated = true;
                    }
                    if (val.indexOf(")") > -1) {
                        val = val.split(")").join("");
                        updated = true;
                    }
                    if (updated) {
                        e.target.value = val;
                    }
                }
            }, false);
        },
        transformJSONOutput: function (obj) {
            var result = JSON.parse(JSON.stringify(obj, function (key, value) {
                if (key === "field") {
                    if (value.indexOf("sspexp_") === 0) {
                        return value.replace(/sspexp_/gi, "");
                    }
                    return value;
                }
                if (key === "operator") {
                    if (value === "equal") {
                        return "EQ";
                    }
                    if (value === "not_equal") {
                        return "NE";
                    }
                    if (value === "less") {
                        return "LT";
                    }
                    if (value === "less_or_equal") {
                        return "LE";
                    }
                    if (value === "greater") {
                        return "GT";
                    }
                    if (value === "greater_or_equal") {
                        return "GE";
                    }
                    return value;
                }
                return value;
            }));
            return result;
        },
        transformSQLToAHExpression: function (sql) {
            var resultAsObject = QueryBuilderUtil.transformJSONOutput($('#builder').queryBuilder('getRules', {
                get_flags: true,
                skip_empty: true
            }));

            var result = sql;
            result = result.replace(/ != /gi, " NE ");
            result = result.replace(/ = /gi, " EQ ");
            result = result.replace(/ < /gi, " LT ");
            result = result.replace(/ <= /gi, " LE ");
            result = result.replace(/ > /gi, " GT ");
            result = result.replace(/ >= /gi, " GE ");
            result = result.replace(/sspexp_/gi, "");
            result = result.replace(/'/gi, "");

            /** START OF WRAPPING INDIVIDUAL RULES INSIDE PARENTHESES LOGIC */
            /** Ensure that substring wrapping in ( ) is done based on superstring comparison */
            /** First update the longer rules then update the smaller rules */
            var dupMap = {};
            var ruleArray = [];
            JSON.stringify(resultAsObject, function (key, value) {
                if (key === "rules" && (value instanceof Array)) {
                    value.forEach((rule) => {
                        if ("field" in rule && "operator" in rule && "value" in rule) {
                            var _r = rule.field + " " + rule.operator + " " + rule.value;
                            if (!dupMap[_r]) {
                                ruleArray.push(_r);
                                dupMap[_r] = "Y";
                            }
                        }
                    });
                }
                return value;
            });
            ruleArray.sort(function (r1, r2) {
                /** Sort Descending to place longer rules at top of array */
                return -1 * ((r1.length > r2.length) ? 1 : (r1.length < r2.length) ? -1 : 0);
            });
            var tokenMap = {};
            ruleArray.forEach(function (_r) {
                var token = "PARSINGTOKEN_" + ("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("").sort(function () { return Math.random() - Math.random(); }).join(""));
                tokenMap[token] = _r;
                result = result.split(_r).join("(" + token + ")");
            });
            for (var key in tokenMap) {
                if (key.indexOf("PARSINGTOKEN_") === 0) {
                    result = result.split(key).join(tokenMap[key]);
                }
            }
            /** END OF WRAPPING INDIVIDUAL RULES INSIDE PARENTHESES LOGIC */

            result = "(" + result + ")";
            result = result.split("(").map((t) => { return t.trim(); }).join("(").split(")").map((t) => { return t.trim(); }).join(")").replace(/\)and\(/gi, ") AND (").replace(/\)or\(/gi, ") OR (");
            return result;
        },
        transformAHExpressonToSQL: function (expr) {
            var result = expr;

            result = result.split("(").map((t) => {
                return t.trim();
            }).join("(").split(")").map((t) => {
                return t.trim();
            }).join(")")
                .replace(/\)and/gi, ") AND")
                .replace(/and\(/gi, "AND (")
                .replace(/\)or/gi, ") OR")
                .replace(/or\(/gi, "OR (");

            result = result.replace(/\(group /gi, "(sspexp_group ");

            var parsedEQStatements = result.split("EQ ").join("EQ '");
            while (parsedEQStatements.indexOf("EQ '") > -1) {
                var s = parsedEQStatements.substring(0, parsedEQStatements.indexOf("EQ '"));
                var e = parsedEQStatements.substring(parsedEQStatements.indexOf("EQ '"));
                e = e.replace(")", "')");
                parsedEQStatements = s + e;
                parsedEQStatements = parsedEQStatements.replace("EQ '", "EQ_OPER_START");
            }
            parsedEQStatements = parsedEQStatements.split("EQ_OPER_START").join("EQ '");
            result = parsedEQStatements;

            var parsedNEStatements = result.split("NE ").join("NE '");
            while (parsedNEStatements.indexOf("NE '") > -1) {
                var s = parsedNEStatements.substring(0, parsedNEStatements.indexOf("NE '"));
                var e = parsedNEStatements.substring(parsedNEStatements.indexOf("NE '"));
                e = e.replace(")", "')");
                parsedNEStatements = s + e;
                parsedNEStatements = parsedNEStatements.replace("NE '", "NE_OPER_START");
            }
            parsedNEStatements = parsedNEStatements.split("NE_OPER_START").join("NE '");
            result = parsedNEStatements;

            result = result.replace(/ NE /gi, " != ");
            result = result.replace(/ EQ /gi, " = ");
            result = result.replace(/ LT /gi, " < ");
            result = result.replace(/ LE /gi, " <= ");
            result = result.replace(/ GT /gi, " > ");
            result = result.replace(/ GE /gi, " >= ");

            return result;
        }
    };
    window.QueryBuilderUtil = QBU;
})());
