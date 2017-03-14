'use strict';

const _ = require('lodash');
const chalk = require('chalk');
const util = require('util');
const child_process = require('child_process');

class Scenario {
    constructor(data) {
        let defaultData = {
            dependsOn: [],
            worker: 'Console',
            finished: false,
            report: null,
            data: {},
            config: {},
            debug: false
        };

        this._data = _.extend(defaultData, data);
        if (data.config && data.config.Test) {
            this._data.data.Test = data.config.Test;
        }
    }
    get name() {
        return this._data.name;
    }
    get dependsOn() {
        return this._data.dependsOn;
    }
    get data() {
        return this._data.data;
    }
    get report() {
        return this._data.report;
    }
    updateData(data) {
        this._data.data = this.deepExtend(this._data.data, data);
    }
    deepExtend(target, source) {
        for (var prop in source) {
            if (
                prop in target &&
                typeof(target[prop]) == 'object' &&
                typeof(source[prop]) == 'object'
            ) {
                this.deepExtend(target[prop], source[prop]);
            } else {
                target[prop] = source[prop];
            }
        }

        return target;
    }
    run(done) {
        let worker = child_process.fork(`${__dirname}/../Worker`);
        let localData = {};

        if (this._data.debug) {
            console.log(`${chalk.green(`[syrup.${this.name}]`)} Starting ${this._data.worker}Worker#${worker.pid} for ${this.name} with  ${JSON.stringify(this)}`);
        }

        worker.on('message', (msg) => {
            if (msg.output) {
                try {
                    this._data.report = JSON.parse(msg.output);
                } catch (error) {
                    this._data.report = msg.output;
                }
                if (this._data.debug) {
                    console.log(`${chalk.green(`[syrup.${this.name}]`)} ${chalk.blue(`[${this._data.worker}Worker#${worker.pid}]`)} Report received from ${this._data.worker}Worker#${worker.pid} ${JSON.stringify(this._data.report)}`);
                }
            }

            if (msg.save) {
                if (this._data.debug) {
                    console.log(`${chalk.green(`[syrup.${this.name}]`)} ${chalk.blue(`[${this._data.worker}Worker#${worker.pid}]`)} Data saved from ${this._data.worker}Worker#${worker.pid} ${JSON.stringify(msg.save)}`);
                }
                _.set(localData, msg.save.path, msg.save.data);
            }

            if (msg.log) {
                if (this._data.debug) {
                    console.log(`${chalk.green(`[syrup.${this.name}]`)} ${chalk.blue(`[${this._data.worker}Worker#${worker.pid}]`)} Log output received: ${msg.log}`);
                }
            }

            if (msg.exit) {
                this._data.finished = true;
                if (this._data.debug) {
                    console.log(`${chalk.green(`[syrup.${this.name}]`)} ${chalk.blue(`[${this._data.worker}Worker#${worker.pid}]`)} Teardown message received from ${this._data.worker}Worker#${worker.pid}`);
                }
                setTimeout(() => worker.kill(), 1000);
            }
        });

        worker.on('exit', () => {
            this._data.finished = true;
            this.updateData(localData);
            done(null, this);
        });

        worker.send({ scenario: this._data });
    }
}

module.exports = Scenario;
