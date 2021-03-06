import { RunUtil } from '../../RunUtil';
const assert = require('assert');
const { HttpServerPatcher } = require('../../../src/patch/HttpServer');
const { RedisPatcher } = require('../../../src/patch/Redis');
const httpServerPatcher = new HttpServerPatcher();
const redisPatcher = new RedisPatcher();

const fakeServer1Port = 30001;
const fakeServer2Port = 30002;

RunUtil.run(function(done) {
  httpServerPatcher.run();
  redisPatcher.run();

  const http = require('http');
  const urllib = require('urllib');
  const Redis = require('ioredis');

  process.on(<any>'PANDORA_PROCESS_MESSAGE_TRACE', (report: any) => {
    assert(report);

    const spans = report.spans;
    // connection to new node may create `info` span
    assert(spans.length >= 3);

    done();
  });

  const cluster = new Redis.Cluster([
    { host: '127.0.0.1', port: fakeServer1Port },
    { host: '127.0.0.1', port: fakeServer2Port }
  ]);

  const server = http.createServer((req, res) => {
    cluster.set('test-redis', 'cluster').then(() => {
      cluster.get('test-redis').then((data) => {
        assert(data === 'cluster');
        res.end(data);
      });
    }).catch((err) => {
      console.log('error: ', err);
    });
  });

  server.listen(0, () => {
    const port = server.address().port;

    setTimeout(function() {
      urllib.request(`http://localhost:${port}/?test=query`);
    }, 500);
  });
});