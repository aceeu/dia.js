module.exports = class {

    constructor (model, ...other) {
    
        this.model = model
        this.cols  = []
        
        let query = this        

        this.Part = class {

            constructor (value) {

                if (value instanceof Object) for (let k in value) this [k] = value [k]; else this [value] = {}
                
                for (let k in this) {
                    let v = this [k]
                    delete this [k]
                    let src = k.trim ()

                    let join_hint
                    [src, join_hint] = src.split (/\s+ON\s+/)
                    if (join_hint) this.join_hint = join_hint
                    
                    if (src.indexOf ('(') >= 0) {
                        let [pre, c, post] = src.split (/[\(\)]/)
                        this.cols = c ? c.split (',') : []
                        src = pre + post
                    }
                    else {
                        this.cols = undefined
                    }
                    
                    let [t, a] = src.split (/\s+AS\s+/)
                    this.table = t.trim ()
                    this.alias = (a || t).trim ()
this.src = src                    
                    this.filters = v

                }

            }
            
            adjust_cols () {
            
                let part = this
            
                this.Col = class {

                    constructor (src) {
                    
                        let [expr, alias] = src.split (/\s+AS\s+/)

                        this.part = part
                        this.expr = expr.trim ()

                        this.alias = (alias || expr).trim ()
                        
                        if (part.is_root) {
                            if (this.expr == this.alias) delete this.alias
                        }
                        else {
                            this.alias = `${part.alias}.${this.alias}`
                        }
                        
                        this.expr = part.alias + '.' + this.expr                        
                        this.sql = `\n\t${this.expr}`
                        if (this.alias) this.sql += ` AS "${this.alias}"`

                    }

                }
                
                if (this.cols == undefined) this.cols = model.get_default_query_columns (this)
                
                let cols = []; for (let src of this.cols) {

                    if (src == '*') {
                        for (let c in model.tables [part.table].columns) cols.push (new this.Col (c))
                    }
                    else {
                        cols.push (new this.Col (src))
                    }

                }
                
                for (let col of cols) query.cols.push (col)
                 
            }
            
            adjust_join () {
            
                let adjust_hint = (hint) => {
                    if (hint.indexOf ('=') > -1) return hint                    
                    if (hint.indexOf ('.') < 0) hint = `${query.parts[0].alias}.${hint}`                    
                    return `${hint}=${this.alias}.id`
                }
                
                if (!this.is_root) {
                    if (this.join_hint) this.join_condition = adjust_hint (this.join_hint)
                }
                                    
                this.sql = '\n\t'
                
                if (!this.is_root) this.sql += 'LEFT JOIN '
                this.sql += this.table
                if (this.table != this.alias) this.sql += ` AS ${this.alias}`
                if (!this.is_root) this.sql += ` ON (${this.join_condition})`
                        
            }
           

        }

        this.parts = other.map ((x) => new this.Part (x))
        this.parts [0].is_root = true
        for (let part of this.parts) part.adjust_cols ()
        for (let part of this.parts) part.adjust_join ()
        
        let get_sql = (x) => x.sql
        
        this.sql = 'SELECT '
        this.sql += this.cols.map (get_sql)
        this.sql += '\nFROM '
        this.sql += this.parts.map (get_sql).join ('')

    }

}