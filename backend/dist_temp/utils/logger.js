"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const env_1 = require("../config/env");
const { combine, timestamp, printf, colorize, json } = winston_1.default.format;
const devFormat = combine(colorize(), timestamp({ format: 'HH:mm:ss' }), printf((info) => {
    const { timestamp: ts, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${message}${metaStr}`;
}));
const prodFormat = combine(timestamp(), json());
const logger = winston_1.default.createLogger({
    level: env_1.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: env_1.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    defaultMeta: { service: 'nexclass-api' },
    transports: [
        new winston_1.default.transports.Console(),
        ...(env_1.env.NODE_ENV === 'production'
            ? [
                new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
                new winston_1.default.transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 5 }),
            ]
            : []),
    ],
});
exports.default = logger;
