'use strict';

const _  = require('lodash');
const async = require('async');

const EventsBus = require('../libs/EventsBus');
const Util = require('../libs/Util');

const RequirementDoesNotExistError = require('../errors/RequirementDoesNotExistError');

class BaseWorker {
    constructor(scenario) {
        this.name = scenario.name;
        this.scenario = scenario;
    }
    setup(done) {
        let that = this;
        let globals = _.uniq([
            'assert',
            'get',
            'runs',
            { name: 'save', options: this.scenario.data }
        ].concat(this.scenario.options.requires));

        EventsBus.listen('data:save', (payload) => {
            this.scenario.data = Util.deepExtend(this.scenario.data, _.set({}, payload.path, payload.data));
        });

        try {
            async.filter(globals, function(requirement, callback) {
                if (typeof requirement === 'string') {
                    require(`${__dirname}/../globals/${requirement}`)(callback);
                }
                if (typeof requirement === 'object') {
                    require(`${__dirname}/../globals/${requirement.name}`)(callback, requirement.options);
                }
            }, function (err, results) {
                if (typeof global.Scenario === 'undefined') {
                    global.Scenario = that.scenario;
                }
                done();
            });
        } catch (err) {
            throw new RequirementDoesNotExistError(err.toString().replace(/^([\s\S]+(globals\/))/, '').replace("\'", ''));
        }
    }
    run(done) {
        EventsBus.emit('worker:started', { name: this.scenario.name });
        done();
    }
}

module.exports = BaseWorker;