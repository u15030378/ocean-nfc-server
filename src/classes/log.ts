import * as jsonfile from "jsonfile";
import * as axios from "axios";
import * as fs from "fs";

export class Log {
  private static instance = null;
  public static getInstance(): Log {
    if (Log.instance === null) {
      Log.instance = new Log();
    }
    return Log.instance;
  }

  private file = "./log.json";

  private isSendingFile = false;

  private constructor() {}

  /**
   * Initialises the json log file
   */
  public initialiseLogFile() {
    const header = { system: "CRDS", data: [] };
    this.writeToLogFile(header);
    console.log("Log file has been initialised.");
  }

  /**
   * Adds an item to the log file
   * @param logData
   */
  public addLogItem(logData) {
    if (!fs.existsSync("./log.json")) {
      this.initialiseLogFile();
    }

    var fileObj = jsonfile.readFileSync(this.file);

    const log = {
      timestamp: logData[0],
      statusCode: logData[1],
      method: logData[2],
      url: logData[3],
      query: logData[4],
      ip: logData[5]
    };

    fileObj["data"].push(log);
    this.writeToLogFile(fileObj);
    console.log("Log Item was appended to file.");

    if (fileObj["data"].length >= 100 && !this.isSendingFile) {
      this.sendLogFile(fileObj);
    }
  }

  /**
   * Writes the logs into the log file
   * @param jsonObj
   */
  private writeToLogFile(jsonObj) {
    jsonfile.writeFileSync(this.file, jsonObj, { flag: "w" }, function(err) {
      if (err) console.error(err);
    });
  }

  /**
   * Sends the log file data to the reporting subsystem
   * @param fileData
   */
  private sendLogFile(fileData) {
    this.isSendingFile = true;
    const lastLogIndex = fileData.data.length;

    axios.default
      .post("https://fnbreports-6455.nodechef.com/api", {
        system: "CRDS",
        data: JSON.stringify(fileData.data)
      })
      .then(res => {
        console.log(
          "Log file has be sent to reporting statusCode: " + res.status
        );
        console.log(res.data);

        // remove the logs sent from the file
        const file: {data: any[], system: string} = jsonfile.readFileSync(this.file);
        file.data = file.data.slice(lastLogIndex);
        this.writeToLogFile(file);
        this.isSendingFile = false;
      })
      .catch(err => {
        console.error(err.status + " " + err.data);
        this.isSendingFile = false;
      });
  }

  public async reset() {
    await this.initialiseLogFile();
  }
}

class Lock {
  private isLocked = false;
  private waiting = [];
  private fn: (...parameters) => Promise<void>;

  costructor(lockedFn: (...parameters) => Promise<void>) {
    this.fn = lockedFn;
  }

  public request(...parameters): Promise<any> {
    return new Promise(async resolve => {
      const waiter = new ExternalPromise().getPromise();

      if (this.isLocked) {
        this.waiting.push(waiter);
        await waiter;
      }

      this.isLocked = true;
      await this.fn(...parameters);
      this.isLocked = false;

      if (this.waiting.length) {
        this.waiting[0].resolve();
      }

      resolve();
    });
  }
}

class ExternalPromise {
  private resolver;
  private promise;

  constructor() {
    this.promise = new Promise(resolve => {
      this.resolver = resolve;
    });
  }

  public resolve() {
    this.resolver();
  }

  public getPromise() {
    return this.promise;
  }
}
