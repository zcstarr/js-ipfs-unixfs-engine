/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const BlockService = require('ipfs-block-service')
const pull = require('pull-stream')
const mh = require('multihashes')
const Ipld = require('ipld')
const eachSeries = require('async').eachSeries
const CID = require('cids')
const UnixFS = require('ipfs-unixfs')
const createBuilder = require('../src/builder')
const FixedSizeChunker = require('../src/chunker/fixed-size')

module.exports = (repo) => {
  describe('builder', () => {
    let ipld

    const testMultihashes = Object.keys(mh.names).slice(0, 40)

    before(() => {
      const bs = new BlockService(repo)
      ipld = new Ipld(bs)
    })

    it('allows multihash hash algorithm to be specified', (done) => {
      eachSeries(testMultihashes, (hashAlg, cb) => {
        const options = { hashAlg, strategy: 'flat' }
        const content = String(Math.random() + Date.now())
        const inputFile = {
          path: content + '.txt',
          content: Buffer.from(content)
        }

        const onCollected = (err, nodes) => {
          if (err) return cb(err)

          const node = nodes[0]
          expect(node).to.exist()

          // Verify multihash has been encoded using hashAlg
          expect(mh.decode(node.multihash).name).to.equal(hashAlg)

          // Fetch using hashAlg encoded multihash
          ipld.get(new CID(node.multihash), '', {onlyNode: true}, (err, res) => {
            if (err) return cb(err)
            const content = UnixFS.unmarshal(res[0].value.data).data
            expect(content.equals(inputFile.content)).to.be.true()
            cb()
          })
        }

        pull(
          pull.values([Object.assign({}, inputFile)]),
          createBuilder(FixedSizeChunker, ipld, options),
          pull.collect(onCollected)
        )
      }, done)
    })

    it('allows multihash hash algorithm to be specified for big file', (done) => {
      eachSeries(testMultihashes, (hashAlg, cb) => {
        const options = { hashAlg, strategy: 'flat' }
        const content = String(Math.random() + Date.now())
        const inputFile = {
          path: content + '.txt',
          // Bigger than maxChunkSize
          content: Buffer.alloc(262144 + 5).fill(1)
        }

        const onCollected = (err, nodes) => {
          if (err) return cb(err)

          const node = nodes[0]

          try {
            expect(node).to.exist()
            expect(mh.decode(node.multihash).name).to.equal(hashAlg)
          } catch (err) {
            return cb(err)
          }

          cb()
        }

        pull(
          pull.values([Object.assign({}, inputFile)]),
          createBuilder(FixedSizeChunker, ipld, options),
          pull.collect(onCollected)
        )
      }, done)
    })
  })
}
