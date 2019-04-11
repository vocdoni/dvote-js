import BaseSettings from "./config-default";
import TestSettings from "./config-test";

let config = BaseSettings;

switch (process.env.NODE_ENV) {
  case "test":
    config = Object.assign({}, BaseSettings, TestSettings);
    break;
}

export default config;
