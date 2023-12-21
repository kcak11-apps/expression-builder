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

            JSON.stringify(resultAsObject, function (key, value) {
                if (key === "rules" && (value instanceof Array)) {
                    value.forEach((rule) => {
                        var _r = rule.field + " " + rule.operator + " " + rule.value;
                        result = result.split(_r).join("(" + _r + ")");
                    });
                }
                return value;
            });
            result = "(" + result + ")";
            result = result.split("(").map((t) => { return t.trim(); }).join("(").split(")").map((t) => { return t.trim(); }).join(")").replace(/\)and\(/gi, ") AND (").replace(/\)or\(/gi, ") OR (");
            return result;
        }
    };
    window.QueryBuilderUtil = QBU;
})());
