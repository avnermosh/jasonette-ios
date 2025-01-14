'use strict';

/*!
 * ZipLoader
 * (c) 2017 @yomotsu
 * Released under the MIT License.
 * 
 * ZipLoader uses the library pako released under the MIT license :
 * https://github.com/nodeca/pako/blob/master/LICENSE
 */

import {Loader as THREE_Loader,
        JSONLoader as THREE_JSONLoader,
        Texture as THREE_Texture
       } from './three.js/three.js-r135/build/three.module.js';
       
import { COL } from  "../col/COL.js";
import "../col/core/ImageFile.js";


function createCommonjsModule(fn, module) {
    return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var common = createCommonjsModule(function (module, exports) {
    var TYPED_OK =  (typeof Uint8Array !== 'undefined') &&
        (typeof Uint16Array !== 'undefined') &&
        (typeof Int32Array !== 'undefined');

    function _has(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    exports.assign = function (obj /*from1, from2, from3, ...*/) {
        var sources = Array.prototype.slice.call(arguments, 1);
        while (sources.length) {
            var source = sources.shift();
            if (!source) { continue; }

            if (typeof source !== 'object') {
                throw new TypeError(source + 'must be non-object');
            }

            for (var p in source) {
                if (_has(source, p)) {
                    obj[p] = source[p];
                }
            }
        }

        return obj;
    };


    // reduce buffer size, avoiding mem copy
    exports.shrinkBuf = function (buf, size) {
        if (buf.length === size) { return buf; }
        if (buf.subarray) { return buf.subarray(0, size); }
        buf.length = size;
        return buf;
    };


    var fnTyped = {
        arraySet: function (dest, src, src_offs, len, dest_offs) {
            if (src.subarray && dest.subarray) {
                dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
                return;
            }
            // Fallback to ordinary array
            for (var i = 0; i < len; i++) {
                dest[dest_offs + i] = src[src_offs + i];
            }
        },
        // Join array of chunks to single array.
        flattenChunks: function (chunks) {
            var i, l, len, pos, chunk, result;

            // calculate data length
            len = 0;
            for (i = 0, l = chunks.length; i < l; i++) {
                len += chunks[i].length;
            }

            // join chunks
            result = new Uint8Array(len);
            pos = 0;
            for (i = 0, l = chunks.length; i < l; i++) {
                chunk = chunks[i];
                result.set(chunk, pos);
                pos += chunk.length;
            }

            return result;
        }
    };

    var fnUntyped = {
        arraySet: function (dest, src, src_offs, len, dest_offs) {
            for (var i = 0; i < len; i++) {
                dest[dest_offs + i] = src[src_offs + i];
            }
        },
        // Join array of chunks to single array.
        flattenChunks: function (chunks) {
            return [].concat.apply([], chunks);
        }
    };


    // Enable/Disable typed arrays use, for testing
    //
    exports.setTyped = function (on) {
        if (on) {
            exports.Buf8  = Uint8Array;
            exports.Buf16 = Uint16Array;
            exports.Buf32 = Int32Array;
            exports.assign(exports, fnTyped);
        } else {
            exports.Buf8  = Array;
            exports.Buf16 = Array;
            exports.Buf32 = Array;
            exports.assign(exports, fnUntyped);
        }
    };

    exports.setTyped(TYPED_OK);
});
var common_1 = common.assign;
var common_2 = common.shrinkBuf;
var common_3 = common.setTyped;
var common_4 = common.Buf8;
var common_5 = common.Buf16;
var common_6 = common.Buf32;

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function adler32(adler, buf, len, pos) {
    var s1 = (adler & 0xffff) |0,
        s2 = ((adler >>> 16) & 0xffff) |0,
        n = 0;

    while (len !== 0) {
        // Set limit ~ twice less than 5552, to keep
        // s2 in 31-bits, because we force signed ints.
        // in other case %= will fail.
        n = len > 2000 ? 2000 : len;
        len -= n;

        do {
            s1 = (s1 + buf[pos++]) |0;
            s2 = (s2 + s1) |0;
        } while (--n);

        s1 %= 65521;
        s2 %= 65521;
    }

    return (s1 | (s2 << 16)) |0;
}


var adler32_1 = adler32;

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
function makeTable() {
    var c, table = [];

    for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
    }

    return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();


function crc32(crc, buf, len, pos) {
    var t = crcTable,
        end = pos + len;

    crc ^= -1;

    for (var i = pos; i < end; i++) {
        crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    }

    return (crc ^ (-1)); // >>> 0;
}


var crc32_1 = crc32;

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
var BAD = 30;       /* got a data error -- remain here until reset */
var TYPE = 12;      /* i: waiting for type bits, including last-flag bit */

/*
  Decode literal, length, and distance codes and write out the resulting
  literal and match bytes until either not enough input or output is
  available, an end-of-block is encountered, or a data error is encountered.
  When large enough input and output buffers are supplied to inflate(), for
  example, a 16K input buffer and a 64K output buffer, more than 95% of the
  inflate execution time is spent in this routine.

  Entry assumptions:

  state.mode === LEN
  strm.avail_in >= 6
  strm.avail_out >= 258
  start >= strm.avail_out
  state.bits < 8

  On return, state.mode is one of:

  LEN -- ran out of enough output space or enough available input
  TYPE -- reached end of block code, inflate() to interpret next block
  BAD -- error in block data

  Notes:

  - The maximum input bits used by a length/distance pair is 15 bits for the
  length code, 5 bits for the length extra, 15 bits for the distance code,
  and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
  Therefore if strm.avail_in >= 6, then there is enough input to avoid
  checking for available input while decoding.

  - The maximum bytes that a single length/distance pair can output is 258
  bytes, which is the maximum length that can be coded.  inflate_fast()
  requires strm.avail_out >= 258 for each loop to avoid checking for
  output space.
*/
var inffast = function inflate_fast(strm, start) {
    var state;
    var _in;                    /* local strm.input */
    var last;                   /* have enough input while in < last */
    var _out;                   /* local strm.output */
    var beg;                    /* inflate()'s initial strm.output */
    var end;                    /* while out < end, enough space available */
    //#ifdef INFLATE_STRICT
    var dmax;                   /* maximum distance from zlib header */
    //#endif
    var wsize;                  /* window size or zero if not using window */
    var whave;                  /* valid bytes in the window */
    var wnext;                  /* window write index */
    // Use `s_window` instead `window`, avoid conflict with instrumentation tools
    var s_window;               /* allocated sliding window, if wsize != 0 */
    var hold;                   /* local strm.hold */
    var bits;                   /* local strm.bits */
    var lcode;                  /* local strm.lencode */
    var dcode;                  /* local strm.distcode */
    var lmask;                  /* mask for first level of length codes */
    var dmask;                  /* mask for first level of distance codes */
    var here;                   /* retrieved table entry */
    var op;                     /* code bits, operation, extra bits, or */
    /*  window position, window bytes to copy */
    var len;                    /* match length, unused bytes */
    var dist;                   /* match distance */
    var from;                   /* where to copy match from */
    var from_source;


    var input, output; // JS specific, because we have no pointers

    /* copy state to local variables */
    state = strm.state;
    //here = state.here;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
    //#ifdef INFLATE_STRICT
    dmax = state.dmax;
    //#endif
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;


    /* decode literals and length/distances until end-of-block or not enough
       input data or output space */

    top:
    do {
        if (bits < 15) {
            hold += input[_in++] << bits;
            bits += 8;
            hold += input[_in++] << bits;
            bits += 8;
        }

        here = lcode[hold & lmask];

        dolen:
        for (;;) { // Goto emulation
            op = here >>> 24/*here.bits*/;
            hold >>>= op;
            bits -= op;
            op = (here >>> 16) & 0xff/*here.op*/;
            if (op === 0) {                          /* literal */
                //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
                //        "inflate:         literal '%c'\n" :
                //        "inflate:         literal 0x%02x\n", here.val));
                output[_out++] = here & 0xffff/*here.val*/;
            }
            else if (op & 16) {                     /* length base */
                len = here & 0xffff/*here.val*/;
                op &= 15;                           /* number of extra bits */
                if (op) {
                    if (bits < op) {
                        hold += input[_in++] << bits;
                        bits += 8;
                    }
                    len += hold & ((1 << op) - 1);
                    hold >>>= op;
                    bits -= op;
                }
                //Tracevv((stderr, "inflate:         length %u\n", len));
                if (bits < 15) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    hold += input[_in++] << bits;
                    bits += 8;
                }
                here = dcode[hold & dmask];

                dodist:
                for (;;) { // goto emulation
                    op = here >>> 24/*here.bits*/;
                    hold >>>= op;
                    bits -= op;
                    op = (here >>> 16) & 0xff/*here.op*/;

                    if (op & 16) {                      /* distance base */
                        dist = here & 0xffff/*here.val*/;
                        op &= 15;                       /* number of extra bits */
                        if (bits < op) {
                            hold += input[_in++] << bits;
                            bits += 8;
                            if (bits < op) {
                                hold += input[_in++] << bits;
                                bits += 8;
                            }
                        }
                        dist += hold & ((1 << op) - 1);
                        //#ifdef INFLATE_STRICT
                        if (dist > dmax) {
                            strm.msg = 'invalid distance too far back';
                            state.mode = BAD;
                            break top;
                        }
                        //#endif
                        hold >>>= op;
                        bits -= op;
                        //Tracevv((stderr, "inflate:         distance %u\n", dist));
                        op = _out - beg;                /* max distance in output */
                        if (dist > op) {                /* see if copy from window */
                            op = dist - op;               /* distance back in window */
                            if (op > whave) {
                                if (state.sane) {
                                    strm.msg = 'invalid distance too far back';
                                    state.mode = BAD;
                                    break top;
                                }

                                // (!) This block is disabled in zlib defaults,
                                // don't enable it for binary compatibility
                                //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                                //                if (len <= op - whave) {
                                //                  do {
                                //                    output[_out++] = 0;
                                //                  } while (--len);
                                //                  continue top;
                                //                }
                                //                len -= op - whave;
                                //                do {
                                //                  output[_out++] = 0;
                                //                } while (--op > whave);
                                //                if (op === 0) {
                                //                  from = _out - dist;
                                //                  do {
                                //                    output[_out++] = output[from++];
                                //                  } while (--len);
                                //                  continue top;
                                //                }
                                //#endif
                            }
                            from = 0; // window index
                            from_source = s_window;
                            if (wnext === 0) {           /* very common case */
                                from += wsize - op;
                                if (op < len) {         /* some from window */
                                    len -= op;
                                    do {
                                        output[_out++] = s_window[from++];
                                    } while (--op);
                                    from = _out - dist;  /* rest from output */
                                    from_source = output;
                                }
                            }
                            else if (wnext < op) {      /* wrap around window */
                                from += wsize + wnext - op;
                                op -= wnext;
                                if (op < len) {         /* some from end of window */
                                    len -= op;
                                    do {
                                        output[_out++] = s_window[from++];
                                    } while (--op);
                                    from = 0;
                                    if (wnext < len) {  /* some from start of window */
                                        op = wnext;
                                        len -= op;
                                        do {
                                            output[_out++] = s_window[from++];
                                        } while (--op);
                                        from = _out - dist;      /* rest from output */
                                        from_source = output;
                                    }
                                }
                            }
                            else {                      /* contiguous in window */
                                from += wnext - op;
                                if (op < len) {         /* some from window */
                                    len -= op;
                                    do {
                                        output[_out++] = s_window[from++];
                                    } while (--op);
                                    from = _out - dist;  /* rest from output */
                                    from_source = output;
                                }
                            }
                            while (len > 2) {
                                output[_out++] = from_source[from++];
                                output[_out++] = from_source[from++];
                                output[_out++] = from_source[from++];
                                len -= 3;
                            }
                            if (len) {
                                output[_out++] = from_source[from++];
                                if (len > 1) {
                                    output[_out++] = from_source[from++];
                                }
                            }
                        }
                        else {
                            from = _out - dist;          /* copy direct from output */
                            do {                        /* minimum length is three */
                                output[_out++] = output[from++];
                                output[_out++] = output[from++];
                                output[_out++] = output[from++];
                                len -= 3;
                            } while (len > 2);
                            if (len) {
                                output[_out++] = output[from++];
                                if (len > 1) {
                                    output[_out++] = output[from++];
                                }
                            }
                        }
                    }
                    else if ((op & 64) === 0) {          /* 2nd level distance code */
                        here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
                        continue dodist;
                    }
                    else {
                        strm.msg = 'invalid distance code';
                        state.mode = BAD;
                        break top;
                    }

                    break; // need to emulate goto via "continue"
                }
            }
            else if ((op & 64) === 0) {              /* 2nd level length code */
                here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
                continue dolen;
            }
            else if (op & 32) {                     /* end-of-block */
                //Tracevv((stderr, "inflate:         end of block\n"));
                state.mode = TYPE;
                break top;
            }
            else {
                strm.msg = 'invalid literal/length code';
                state.mode = BAD;
                break top;
            }

            break; // need to emulate goto via "continue"
        }
    } while (_in < last && _out < end);

    /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;

    /* update state and return */
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
    strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
    state.hold = hold;
    state.bits = bits;
    return;
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.



var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

var CODES = 0;
var LENS = 1;
var DISTS = 2;

var lbase = [ /* Length codes 257..285 base */
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
];

var lext = [ /* Length codes 257..285 extra */
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
    19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
];

var dbase = [ /* Distance codes 0..29 base */
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577, 0, 0
];

var dext = [ /* Distance codes 0..29 extra */
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
    23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
    28, 28, 29, 29, 64, 64
];

var inftrees = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts)
{
    var bits = opts.bits;
    //here = opts.here; /* table entry for duplication */

    var len = 0;               /* a code's length in bits */
    var sym = 0;               /* index of code symbols */
    var min = 0, max = 0;          /* minimum and maximum code lengths */
    var root = 0;              /* number of index bits for root table */
    var curr = 0;              /* number of index bits for current table */
    var drop = 0;              /* code bits to drop for sub-table */
    var left = 0;                   /* number of prefix codes available */
    var used = 0;              /* code entries in table used */
    var huff = 0;              /* Huffman code */
    var incr;              /* for incrementing code, index */
    var fill;              /* index for replicating entries */
    var low;               /* low bits for current root entry */
    var mask;              /* mask for low root bits */
    var next;             /* next available space in table */
    var base = null;     /* base value table to use */
    var base_index = 0;
    //  var shoextra;    /* extra bits table to use */
    var end;                    /* use base and extra for symbol > end */
    var count = new common.Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
    var offs = new common.Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
    var extra = null;
    var extra_index = 0;

    var here_bits, here_op, here_val;

    /*
      Process a set of code lengths to create a canonical Huffman code.  The
      code lengths are lens[0..codes-1].  Each length corresponds to the
      symbols 0..codes-1.  The Huffman code is generated by first sorting the
      symbols by length from short to long, and retaining the symbol order
      for codes with equal lengths.  Then the code starts with all zero bits
      for the first code of the shortest length, and the codes are integer
      increments for the same length, and zeros are appended as the length
      increases.  For the deflate format, these bits are stored backwards
      from their more natural integer increment ordering, and so when the
      decoding tables are built in the large loop below, the integer codes
      are incremented backwards.

      This routine assumes, but does not check, that all of the entries in
      lens[] are in the range 0..MAXBITS.  The caller must assure this.
      1..MAXBITS is interpreted as that code length.  zero means that that
      symbol does not occur in this code.

      The codes are sorted by computing a count of codes for each length,
      creating from that a table of starting indices for each length in the
      sorted table, and then entering the symbols in order in the sorted
      table.  The sorted table is work[], with that space being provided by
      the caller.

      The length counts are used for other purposes as well, i.e. finding
      the minimum and maximum length codes, determining if there are any
      codes at all, checking for a valid set of lengths, and looking ahead
      at length counts to determine sub-table sizes when building the
      decoding tables.
    */

    /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
    for (len = 0; len <= MAXBITS; len++) {
        count[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
        count[lens[lens_index + sym]]++;
    }

    /* bound code lengths, force root to be within code lengths */
    root = bits;
    for (max = MAXBITS; max >= 1; max--) {
        if (count[max] !== 0) { break; }
    }
    if (root > max) {
        root = max;
    }
    if (max === 0) {                     /* no symbols to code at all */
        //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
        //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
        //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
        table[table_index++] = (1 << 24) | (64 << 16) | 0;


        //table.op[opts.table_index] = 64;
        //table.bits[opts.table_index] = 1;
        //table.val[opts.table_index++] = 0;
        table[table_index++] = (1 << 24) | (64 << 16) | 0;

        opts.bits = 1;
        return 0;     /* no symbols, but wait for decoding to report error */
    }
    for (min = 1; min < max; min++) {
        if (count[min] !== 0) { break; }
    }
    if (root < min) {
        root = min;
    }

    /* check for an over-subscribed or incomplete set of lengths */
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
        left <<= 1;
        left -= count[len];
        if (left < 0) {
            return -1;
        }        /* over-subscribed */
    }
    if (left > 0 && (type === CODES || max !== 1)) {
        return -1;                      /* incomplete set */
    }

    /* generate offsets into symbol table for each length for sorting */
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
        offs[len + 1] = offs[len] + count[len];
    }

    /* sort symbols by length, by symbol order within each length */
    for (sym = 0; sym < codes; sym++) {
        if (lens[lens_index + sym] !== 0) {
            work[offs[lens[lens_index + sym]]++] = sym;
        }
    }

    /*
      Create and fill in decoding tables.  In this loop, the table being
      filled is at next and has curr index bits.  The code being used is huff
      with length len.  That code is converted to an index by dropping drop
      bits off of the bottom.  For codes where len is less than drop + curr,
      those top drop + curr - len bits are incremented through all values to
      fill the table with replicated entries.

      root is the number of index bits for the root table.  When len exceeds
      root, sub-tables are created pointed to by the root entry with an index
      of the low root bits of huff.  This is saved in low to check for when a
      new sub-table should be started.  drop is zero when the root table is
      being filled, and drop is root when sub-tables are being filled.

      When a new sub-table is needed, it is necessary to look ahead in the
      code lengths to determine what size sub-table is needed.  The length
      counts are used for this, and so count[] is decremented as codes are
      entered in the tables.

      used keeps track of how many table entries have been allocated from the
      provided *table space.  It is checked for LENS and DIST tables against
      the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
      the initial root table size constants.  See the comments in inftrees.h
      for more information.

      sym increments through all symbols, and the loop terminates when
      all codes of length max, i.e. all codes, have been processed.  This
      routine permits incomplete codes, so another loop after this one fills
      in the rest of the decoding tables with invalid code markers.
    */

    /* set up for code type */
    // poor man optimization - use if-else instead of switch,
    // to avoid deopts in old v8
    if (type === CODES) {
        base = extra = work;    /* dummy value--not used */
        end = 19;

    } else if (type === LENS) {
        base = lbase;
        base_index -= 257;
        extra = lext;
        extra_index -= 257;
        end = 256;

    } else {                    /* DISTS */
        base = dbase;
        extra = dext;
        end = -1;
    }

    /* initialize opts for loop */
    huff = 0;                   /* starting code */
    sym = 0;                    /* starting code symbol */
    len = min;                  /* starting code length */
    next = table_index;              /* current table to fill in */
    curr = root;                /* current table index bits */
    drop = 0;                   /* current bits to drop from code for index */
    low = -1;                   /* trigger new sub-table when len > root */
    used = 1 << root;          /* use root table entries */
    mask = used - 1;            /* mask for comparing low */

    /* check available table space */
    if ((type === LENS && used > ENOUGH_LENS) ||
        (type === DISTS && used > ENOUGH_DISTS)) {
        return 1;
    }

    /* process all codes and make table entries */
    for (;;) {
        /* create table entry */
        here_bits = len - drop;
        if (work[sym] < end) {
            here_op = 0;
            here_val = work[sym];
        }
        else if (work[sym] > end) {
            here_op = extra[extra_index + work[sym]];
            here_val = base[base_index + work[sym]];
        }
        else {
            here_op = 32 + 64;         /* end of block */
            here_val = 0;
        }

        /* replicate for those indices with low len bits equal to huff */
        incr = 1 << (len - drop);
        fill = 1 << curr;
        min = fill;                 /* save offset to next table */
        do {
            fill -= incr;
            table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
        } while (fill !== 0);

        /* backwards increment the len-bit code huff */
        incr = 1 << (len - 1);
        while (huff & incr) {
            incr >>= 1;
        }
        if (incr !== 0) {
            huff &= incr - 1;
            huff += incr;
        } else {
            huff = 0;
        }

        /* go to next symbol, update count, len */
        sym++;
        if (--count[len] === 0) {
            if (len === max) { break; }
            len = lens[lens_index + work[sym]];
        }

        /* create new sub-table if needed */
        if (len > root && (huff & mask) !== low) {
            /* if first time, transition to sub-tables */
            if (drop === 0) {
                drop = root;
            }

            /* increment past last table */
            next += min;            /* here min is 1 << curr */

            /* determine length of next table */
            curr = len - drop;
            left = 1 << curr;
            while (curr + drop < max) {
                left -= count[curr + drop];
                if (left <= 0) { break; }
                curr++;
                left <<= 1;
            }

            /* check for enough space */
            used += 1 << curr;
            if ((type === LENS && used > ENOUGH_LENS) ||
                (type === DISTS && used > ENOUGH_DISTS)) {
                return 1;
            }

            /* point entry in root table to sub-table */
            low = huff & mask;
            /*table.op[low] = curr;
              table.bits[low] = root;
              table.val[low] = next - opts.table_index;*/
            table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
        }
    }

    /* fill in remaining table entry if code is incomplete (guaranteed to have
       at most one remaining entry, since if the code is incomplete, the
       maximum code length that was allowed to get this far is one bit) */
    if (huff !== 0) {
        //table.op[next + huff] = 64;            /* invalid code marker */
        //table.bits[next + huff] = len - drop;
        //table.val[next + huff] = 0;
        table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
    }

    /* set return parameters */
    //opts.table_index += used;
    opts.bits = root;
    return 0;
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.







var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
//var Z_NO_FLUSH      = 0;
//var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
//var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;

/* The deflate compression method */
var Z_DEFLATED  = 8;


/* STATES ====================================================================*/
/* ===========================================================================*/


var    HEAD = 1;       /* i: waiting for magic header */
var    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
var    TIME = 3;       /* i: waiting for modification time (gzip) */
var    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
var    EXLEN = 5;      /* i: waiting for extra length (gzip) */
var    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
var    NAME = 7;       /* i: waiting for end of file name (gzip) */
var    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
var    HCRC = 9;       /* i: waiting for header crc (gzip) */
var    DICTID = 10;    /* i: waiting for dictionary check value */
var    DICT = 11;      /* waiting for inflateSetDictionary() call */
var        TYPE$1 = 12;      /* i: waiting for type bits, including last-flag bit */
var        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
var        STORED = 14;    /* i: waiting for stored size (length and complement) */
var        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
var        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
var        TABLE = 17;     /* i: waiting for dynamic block table lengths */
var        LENLENS = 18;   /* i: waiting for code length code lengths */
var        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
var            LEN_ = 20;      /* i: same as LEN below, but only first time in */
var            LEN = 21;       /* i: waiting for length/lit/eob code */
var            LENEXT = 22;    /* i: waiting for length extra bits */
var            DIST = 23;      /* i: waiting for distance code */
var            DISTEXT = 24;   /* i: waiting for distance extra bits */
var            MATCH = 25;     /* o: waiting for output space to copy string */
var            LIT = 26;       /* o: waiting for output space to write literal */
var    CHECK = 27;     /* i: waiting for 32-bit check value */
var    LENGTH = 28;    /* i: waiting for 32-bit length (gzip) */
var    DONE = 29;      /* finished check, done -- remain here until reset */
var    BAD$1 = 30;       /* got a data error -- remain here until reset */
var    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
var    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
//var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_WBITS = MAX_WBITS;


function zswap32(q) {
    return  (((q >>> 24) & 0xff) +
             ((q >>> 8) & 0xff00) +
             ((q & 0xff00) << 8) +
             ((q & 0xff) << 24));
}


function InflateState() {
    this.mode = 0;             /* current inflate mode */
    this.last = false;          /* true if processing last block */
    this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
    this.havedict = false;      /* true if dictionary provided */
    this.flags = 0;             /* gzip header method and flags (0 if zlib) */
    this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
    this.check = 0;             /* protected copy of check value */
    this.total = 0;             /* protected copy of output count */
    // TODO: may be {}
    this.head = null;           /* where to save gzip header information */

    /* sliding window */
    this.wbits = 0;             /* log base 2 of requested window size */
    this.wsize = 0;             /* window size or zero if not using window */
    this.whave = 0;             /* valid bytes in the window */
    this.wnext = 0;             /* window write index */
    this.window = null;         /* allocated sliding window, if needed */

    /* bit accumulator */
    this.hold = 0;              /* input bit accumulator */
    this.bits = 0;              /* number of bits in "in" */

    /* for string and stored block copying */
    this.length = 0;            /* literal or length of data to copy */
    this.offset = 0;            /* distance back to copy string from */

    /* for table and code decoding */
    this.extra = 0;             /* extra bits needed */

    /* fixed and dynamic code tables */
    this.lencode = null;          /* starting table for length/literal codes */
    this.distcode = null;         /* starting table for distance codes */
    this.lenbits = 0;           /* index bits for lencode */
    this.distbits = 0;          /* index bits for distcode */

    /* dynamic table building */
    this.ncode = 0;             /* number of code length code lengths */
    this.nlen = 0;              /* number of length code lengths */
    this.ndist = 0;             /* number of distance code lengths */
    this.have = 0;              /* number of code lengths in lens[] */
    this.next = null;              /* next available space in codes[] */

    this.lens = new common.Buf16(320); /* temporary storage for code lengths */
    this.work = new common.Buf16(288); /* work area for code table building */

    /*
      because we don't have pointers in js, we use lencode and distcode directly
      as buffers so we don't need codes
    */
    //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
    this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
    this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
    this.sane = 0;                   /* if false, allow invalid distance too far */
    this.back = 0;                   /* bits back of last unprocessed length/lit */
    this.was = 0;                    /* initial length of match */
}

function inflateResetKeep(strm) {
    var state;

    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = ''; /*Z_NULL*/
    if (state.wrap) {       /* to support ill-conceived Java test suite */
        strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.dmax = 32768;
    state.head = null/*Z_NULL*/;
    state.hold = 0;
    state.bits = 0;
    //state.lencode = state.distcode = state.next = state.codes;
    state.lencode = state.lendyn = new common.Buf32(ENOUGH_LENS$1);
    state.distcode = state.distdyn = new common.Buf32(ENOUGH_DISTS$1);

    state.sane = 1;
    state.back = -1;
    //Tracev((stderr, "inflate: reset\n"));
    return Z_OK;
}

function inflateReset(strm) {
    var state;

    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);

}

function inflateReset2(strm, windowBits) {
    var wrap;
    var state;

    /* get the state */
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;

    /* extract wrap request from windowBits parameter */
    if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
    }
    else {
        wrap = (windowBits >> 4) + 1;
        if (windowBits < 48) {
            windowBits &= 15;
        }
    }

    /* set number of window bits, free window if different */
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
        return Z_STREAM_ERROR;
    }
    if (state.window !== null && state.wbits !== windowBits) {
        state.window = null;
    }

    /* update state and reset the rest of it */
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
}

function inflateInit2(strm, windowBits) {
    var ret;
    var state;

    if (!strm) { return Z_STREAM_ERROR; }
    //strm.msg = Z_NULL;                 /* in case we return an error */

    state = new InflateState();

    //if (state === Z_NULL) return Z_MEM_ERROR;
    //Tracev((stderr, "inflate: allocated\n"));
    strm.state = state;
    state.window = null/*Z_NULL*/;
    ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK) {
        strm.state = null/*Z_NULL*/;
    }
    return ret;
}

function inflateInit(strm) {
    return inflateInit2(strm, DEF_WBITS);
}


/*
  Return state with length and distance decoding tables and index sizes set to
  fixed code decoding.  Normally this returns fixed tables from inffixed.h.
  If BUILDFIXED is defined, then instead this routine builds the tables the
  first time it's called, and returns those tables the first time and
  thereafter.  This reduces the size of the code by about 2K bytes, in
  exchange for a little execution time.  However, BUILDFIXED should not be
  used for threaded applications, since the rewriting of the tables and virgin
  may not be thread-safe.
*/
var virgin = true;

var lenfix, distfix; // We have no pointers in JS, so keep tables separate

function fixedtables(state) {
    /* build fixed huffman tables if first call (may not be thread safe) */
    if (virgin) {
        var sym;

        lenfix = new common.Buf32(512);
        distfix = new common.Buf32(32);

        /* literal/length table */
        sym = 0;
        while (sym < 144) { state.lens[sym++] = 8; }
        while (sym < 256) { state.lens[sym++] = 9; }
        while (sym < 280) { state.lens[sym++] = 7; }
        while (sym < 288) { state.lens[sym++] = 8; }

        inftrees(LENS$1,  state.lens, 0, 288, lenfix,   0, state.work, { bits: 9 });

        /* distance table */
        sym = 0;
        while (sym < 32) { state.lens[sym++] = 5; }

        inftrees(DISTS$1, state.lens, 0, 32,   distfix, 0, state.work, { bits: 5 });

        /* do this just once */
        virgin = false;
    }

    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
}


/*
  Update the window with the last wsize (normally 32K) bytes written before
  returning.  If window does not exist yet, create it.  This is only called
  when a window is already in use, or when output has been written during this
  inflate call, but the end of the deflate stream has not been reached yet.
  It is also called to create a window for dictionary data when a dictionary
  is loaded.

  Providing output buffers larger than 32K to inflate() should provide a speed
  advantage, since only the last 32K of output is copied to the sliding window
  upon return from inflate(), and since all distances after the first 32K of
  output will fall in the output data, making match copies simpler and faster.
  The advantage may be dependent on the size of the processor's data caches.
*/
function updatewindow(strm, src, end, copy) {
    var dist;
    var state = strm.state;

    /* if it hasn't been done already, allocate space for the window */
    if (state.window === null) {
        state.wsize = 1 << state.wbits;
        state.wnext = 0;
        state.whave = 0;

        state.window = new common.Buf8(state.wsize);
    }

    /* copy state->wsize or less output bytes into the circular window */
    if (copy >= state.wsize) {
        common.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
        state.wnext = 0;
        state.whave = state.wsize;
    }
    else {
        dist = state.wsize - state.wnext;
        if (dist > copy) {
            dist = copy;
        }
        //zmemcpy(state->window + state->wnext, end - copy, dist);
        common.arraySet(state.window, src, end - copy, dist, state.wnext);
        copy -= dist;
        if (copy) {
            //zmemcpy(state->window, end - copy, copy);
            common.arraySet(state.window, src, end - copy, copy, 0);
            state.wnext = copy;
            state.whave = state.wsize;
        }
        else {
            state.wnext += dist;
            if (state.wnext === state.wsize) { state.wnext = 0; }
            if (state.whave < state.wsize) { state.whave += dist; }
        }
    }
    return 0;
}

function inflate(strm, flush) {
    var state;
    var input, output;          // input/output buffers
    var next;                   /* next input INDEX */
    var put;                    /* next output INDEX */
    var have, left;             /* available input and output */
    var hold;                   /* bit buffer */
    var bits;                   /* bits in bit buffer */
    var _in, _out;              /* save starting available input and output */
    var copy;                   /* number of stored or match bytes to copy */
    var from;                   /* where to copy match bytes from */
    var from_source;
    var here = 0;               /* current decoding table entry */
    var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
    //var last;                   /* parent table entry */
    var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
    var len;                    /* length to copy for repeats, bits to drop */
    var ret;                    /* return code */
    var hbuf = new common.Buf8(4);    /* buffer for gzip header crc calculation */
    var opts;

    var n; // temporary var for NEED_BITS

    var order = /* permutation of code lengths */
        [ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ];


    if (!strm || !strm.state || !strm.output ||
        (!strm.input && strm.avail_in !== 0)) {
        return Z_STREAM_ERROR;
    }

    state = strm.state;
    if (state.mode === TYPE$1) { state.mode = TYPEDO; }    /* skip check */


    //--- LOAD() ---
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    //---

    _in = have;
    _out = left;
    ret = Z_OK;

    inf_leave: // goto emulation
    for (;;) {
        switch (state.mode) {
            case HEAD:
                if (state.wrap === 0) {
                    state.mode = TYPEDO;
                    break;
                }
                //=== NEEDBITS(16);
                while (bits < 16) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
                    state.check = 0/*crc32(0L, Z_NULL, 0)*/;
                    //=== CRC2(state.check, hold);
                    hbuf[0] = hold & 0xff;
                    hbuf[1] = (hold >>> 8) & 0xff;
                    state.check = crc32_1(state.check, hbuf, 2, 0);
                    //===//

                    //=== INITBITS();
                    hold = 0;
                    bits = 0;
                    //===//
                    state.mode = FLAGS;
                    break;
                }
                state.flags = 0;           /* expect zlib header */
                if (state.head) {
                    state.head.done = false;
                }
                if (!(state.wrap & 1) ||   /* check if zlib header allowed */
                    (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
                    strm.msg = 'incorrect header check';
                    state.mode = BAD$1;
                    break;
                }
                if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
                    strm.msg = 'unknown compression method';
                    state.mode = BAD$1;
                    break;
                }
                //--- DROPBITS(4) ---//
                hold >>>= 4;
                bits -= 4;
                //---//
                len = (hold & 0x0f)/*BITS(4)*/ + 8;
                if (state.wbits === 0) {
                    state.wbits = len;
                }
                else if (len > state.wbits) {
                    strm.msg = 'invalid window size';
                    state.mode = BAD$1;
                    break;
                }
                state.dmax = 1 << len;
                //Tracev((stderr, "inflate:   zlib header ok\n"));
                strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
                state.mode = hold & 0x200 ? DICTID : TYPE$1;
                //=== INITBITS();
                hold = 0;
                bits = 0;
                //===//
                break;
            case FLAGS:
                //=== NEEDBITS(16); */
                while (bits < 16) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                state.flags = hold;
                if ((state.flags & 0xff) !== Z_DEFLATED) {
                    strm.msg = 'unknown compression method';
                    state.mode = BAD$1;
                    break;
                }
                if (state.flags & 0xe000) {
                    strm.msg = 'unknown header flags set';
                    state.mode = BAD$1;
                    break;
                }
                if (state.head) {
                    state.head.text = ((hold >> 8) & 1);
                }
                if (state.flags & 0x0200) {
                    //=== CRC2(state.check, hold);
                    hbuf[0] = hold & 0xff;
                    hbuf[1] = (hold >>> 8) & 0xff;
                    state.check = crc32_1(state.check, hbuf, 2, 0);
                    //===//
                }
                //=== INITBITS();
                hold = 0;
                bits = 0;
                //===//
                state.mode = TIME;
                /* falls through */
            case TIME:
                //=== NEEDBITS(32); */
                while (bits < 32) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                if (state.head) {
                    state.head.time = hold;
                }
                if (state.flags & 0x0200) {
                    //=== CRC4(state.check, hold)
                    hbuf[0] = hold & 0xff;
                    hbuf[1] = (hold >>> 8) & 0xff;
                    hbuf[2] = (hold >>> 16) & 0xff;
                    hbuf[3] = (hold >>> 24) & 0xff;
                    state.check = crc32_1(state.check, hbuf, 4, 0);
                    //===
                }
                //=== INITBITS();
                hold = 0;
                bits = 0;
                //===//
                state.mode = OS;
                /* falls through */
            case OS:
                //=== NEEDBITS(16); */
                while (bits < 16) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                if (state.head) {
                    state.head.xflags = (hold & 0xff);
                    state.head.os = (hold >> 8);
                }
                if (state.flags & 0x0200) {
                    //=== CRC2(state.check, hold);
                    hbuf[0] = hold & 0xff;
                    hbuf[1] = (hold >>> 8) & 0xff;
                    state.check = crc32_1(state.check, hbuf, 2, 0);
                    //===//
                }
                //=== INITBITS();
                hold = 0;
                bits = 0;
                //===//
                state.mode = EXLEN;
                /* falls through */
            case EXLEN:
                if (state.flags & 0x0400) {
                    //=== NEEDBITS(16); */
                    while (bits < 16) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    state.length = hold;
                    if (state.head) {
                        state.head.extra_len = hold;
                    }
                    if (state.flags & 0x0200) {
                        //=== CRC2(state.check, hold);
                        hbuf[0] = hold & 0xff;
                        hbuf[1] = (hold >>> 8) & 0xff;
                        state.check = crc32_1(state.check, hbuf, 2, 0);
                        //===//
                    }
                    //=== INITBITS();
                    hold = 0;
                    bits = 0;
                    //===//
                }
                else if (state.head) {
                    state.head.extra = null/*Z_NULL*/;
                }
                state.mode = EXTRA;
                /* falls through */
            case EXTRA:
                if (state.flags & 0x0400) {
                    copy = state.length;
                    if (copy > have) { copy = have; }
                    if (copy) {
                        if (state.head) {
                            len = state.head.extra_len - state.length;
                            if (!state.head.extra) {
                                // Use untyped array for more convenient processing later
                                state.head.extra = new Array(state.head.extra_len);
                            }
                            common.arraySet(
                                state.head.extra,
                                input,
                                next,
                                // extra field is limited to 65536 bytes
                                // - no need for additional size check
                                copy,
                                /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                                len
                            );
                            //zmemcpy(state.head.extra + len, next,
                            //        len + copy > state.head.extra_max ?
                            //        state.head.extra_max - len : copy);
                        }
                        if (state.flags & 0x0200) {
                            state.check = crc32_1(state.check, input, copy, next);
                        }
                        have -= copy;
                        next += copy;
                        state.length -= copy;
                    }
                    if (state.length) { break inf_leave; }
                }
                state.length = 0;
                state.mode = NAME;
                /* falls through */
            case NAME:
                if (state.flags & 0x0800) {
                    if (have === 0) { break inf_leave; }
                    copy = 0;
                    do {
                        // TODO: 2 or 1 bytes?
                        len = input[next + copy++];
                        /* use constant limit because in js we should not preallocate memory */
                        if (state.head && len &&
                            (state.length < 65536 /*state.head.name_max*/)) {
                            state.head.name += String.fromCharCode(len);
                        }
                    } while (len && copy < have);

                    if (state.flags & 0x0200) {
                        state.check = crc32_1(state.check, input, copy, next);
                    }
                    have -= copy;
                    next += copy;
                    if (len) { break inf_leave; }
                }
                else if (state.head) {
                    state.head.name = null;
                }
                state.length = 0;
                state.mode = COMMENT;
                /* falls through */
            case COMMENT:
                if (state.flags & 0x1000) {
                    if (have === 0) { break inf_leave; }
                    copy = 0;
                    do {
                        len = input[next + copy++];
                        /* use constant limit because in js we should not preallocate memory */
                        if (state.head && len &&
                            (state.length < 65536 /*state.head.comm_max*/)) {
                            state.head.comment += String.fromCharCode(len);
                        }
                    } while (len && copy < have);
                    if (state.flags & 0x0200) {
                        state.check = crc32_1(state.check, input, copy, next);
                    }
                    have -= copy;
                    next += copy;
                    if (len) { break inf_leave; }
                }
                else if (state.head) {
                    state.head.comment = null;
                }
                state.mode = HCRC;
                /* falls through */
            case HCRC:
                if (state.flags & 0x0200) {
                    //=== NEEDBITS(16); */
                    while (bits < 16) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    if (hold !== (state.check & 0xffff)) {
                        strm.msg = 'header crc mismatch';
                        state.mode = BAD$1;
                        break;
                    }
                    //=== INITBITS();
                    hold = 0;
                    bits = 0;
                    //===//
                }
                if (state.head) {
                    state.head.hcrc = ((state.flags >> 9) & 1);
                    state.head.done = true;
                }
                strm.adler = state.check = 0;
                state.mode = TYPE$1;
                break;
            case DICTID:
                //=== NEEDBITS(32); */
                while (bits < 32) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                strm.adler = state.check = zswap32(hold);
                //=== INITBITS();
                hold = 0;
                bits = 0;
                //===//
                state.mode = DICT;
                /* falls through */
            case DICT:
                if (state.havedict === 0) {
                    //--- RESTORE() ---
                    strm.next_out = put;
                    strm.avail_out = left;
                    strm.next_in = next;
                    strm.avail_in = have;
                    state.hold = hold;
                    state.bits = bits;
                    //---
                    return Z_NEED_DICT;
                }
                strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
                state.mode = TYPE$1;
                /* falls through */
            case TYPE$1:
                if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
                /* falls through */
            case TYPEDO:
                if (state.last) {
                    //--- BYTEBITS() ---//
                    hold >>>= bits & 7;
                    bits -= bits & 7;
                    //---//
                    state.mode = CHECK;
                    break;
                }
                //=== NEEDBITS(3); */
                while (bits < 3) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                state.last = (hold & 0x01)/*BITS(1)*/;
                //--- DROPBITS(1) ---//
                hold >>>= 1;
                bits -= 1;
                //---//

                switch ((hold & 0x03)/*BITS(2)*/) {
                    case 0:                             /* stored block */
                        //Tracev((stderr, "inflate:     stored block%s\n",
                        //        state.last ? " (last)" : ""));
                        state.mode = STORED;
                        break;
                    case 1:                             /* fixed block */
                        fixedtables(state);
                        //Tracev((stderr, "inflate:     fixed codes block%s\n",
                        //        state.last ? " (last)" : ""));
                        state.mode = LEN_;             /* decode codes */
                        if (flush === Z_TREES) {
                            //--- DROPBITS(2) ---//
                            hold >>>= 2;
                            bits -= 2;
                            //---//
                            break inf_leave;
                        }
                        break;
                    case 2:                             /* dynamic block */
                        //Tracev((stderr, "inflate:     dynamic codes block%s\n",
                        //        state.last ? " (last)" : ""));
                        state.mode = TABLE;
                        break;
                    case 3:
                        strm.msg = 'invalid block type';
                        state.mode = BAD$1;
                }
                //--- DROPBITS(2) ---//
                hold >>>= 2;
                bits -= 2;
                //---//
                break;
            case STORED:
                //--- BYTEBITS() ---// /* go to byte boundary */
                hold >>>= bits & 7;
                bits -= bits & 7;
                //---//
                //=== NEEDBITS(32); */
                while (bits < 32) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
                    strm.msg = 'invalid stored block lengths';
                    state.mode = BAD$1;
                    break;
                }
                state.length = hold & 0xffff;
                //Tracev((stderr, "inflate:       stored length %u\n",
                //        state.length));
                //=== INITBITS();
                hold = 0;
                bits = 0;
                //===//
                state.mode = COPY_;
                if (flush === Z_TREES) { break inf_leave; }
                /* falls through */
            case COPY_:
                state.mode = COPY;
                /* falls through */
            case COPY:
                copy = state.length;
                if (copy) {
                    if (copy > have) { copy = have; }
                    if (copy > left) { copy = left; }
                    if (copy === 0) { break inf_leave; }
                    //--- zmemcpy(put, next, copy); ---
                    common.arraySet(output, input, next, copy, put);
                    //---//
                    have -= copy;
                    next += copy;
                    left -= copy;
                    put += copy;
                    state.length -= copy;
                    break;
                }
                //Tracev((stderr, "inflate:       stored end\n"));
                state.mode = TYPE$1;
                break;
            case TABLE:
                //=== NEEDBITS(14); */
                while (bits < 14) {
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                }
                //===//
                state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
                //--- DROPBITS(5) ---//
                hold >>>= 5;
                bits -= 5;
                //---//
                state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
                //--- DROPBITS(5) ---//
                hold >>>= 5;
                bits -= 5;
                //---//
                state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
                //--- DROPBITS(4) ---//
                hold >>>= 4;
                bits -= 4;
                //---//
                //#ifndef PKZIP_BUG_WORKAROUND
                if (state.nlen > 286 || state.ndist > 30) {
                    strm.msg = 'too many length or distance symbols';
                    state.mode = BAD$1;
                    break;
                }
                //#endif
                //Tracev((stderr, "inflate:       table sizes ok\n"));
                state.have = 0;
                state.mode = LENLENS;
                /* falls through */
            case LENLENS:
                while (state.have < state.ncode) {
                    //=== NEEDBITS(3);
                    while (bits < 3) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
                    //--- DROPBITS(3) ---//
                    hold >>>= 3;
                    bits -= 3;
                    //---//
                }
                while (state.have < 19) {
                    state.lens[order[state.have++]] = 0;
                }
                // We have separate tables & no pointers. 2 commented lines below not needed.
                //state.next = state.codes;
                //state.lencode = state.next;
                // Switch to use dynamic table
                state.lencode = state.lendyn;
                state.lenbits = 7;

                opts = { bits: state.lenbits };
                ret = inftrees(CODES$1, state.lens, 0, 19, state.lencode, 0, state.work, opts);
                state.lenbits = opts.bits;

                if (ret) {
                    strm.msg = 'invalid code lengths set';
                    state.mode = BAD$1;
                    break;
                }
                //Tracev((stderr, "inflate:       code lengths ok\n"));
                state.have = 0;
                state.mode = CODELENS;
                /* falls through */
            case CODELENS:
                while (state.have < state.nlen + state.ndist) {
                    for (;;) {
                        here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
                        here_bits = here >>> 24;
                        here_op = (here >>> 16) & 0xff;
                        here_val = here & 0xffff;

                        if ((here_bits) <= bits) { break; }
                        //--- PULLBYTE() ---//
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                        //---//
                    }
                    if (here_val < 16) {
                        //--- DROPBITS(here.bits) ---//
                        hold >>>= here_bits;
                        bits -= here_bits;
                        //---//
                        state.lens[state.have++] = here_val;
                    }
                    else {
                        if (here_val === 16) {
                            //=== NEEDBITS(here.bits + 2);
                            n = here_bits + 2;
                            while (bits < n) {
                                if (have === 0) { break inf_leave; }
                                have--;
                                hold += input[next++] << bits;
                                bits += 8;
                            }
                            //===//
                            //--- DROPBITS(here.bits) ---//
                            hold >>>= here_bits;
                            bits -= here_bits;
                            //---//
                            if (state.have === 0) {
                                strm.msg = 'invalid bit length repeat';
                                state.mode = BAD$1;
                                break;
                            }
                            len = state.lens[state.have - 1];
                            copy = 3 + (hold & 0x03);//BITS(2);
                            //--- DROPBITS(2) ---//
                            hold >>>= 2;
                            bits -= 2;
                            //---//
                        }
                        else if (here_val === 17) {
                            //=== NEEDBITS(here.bits + 3);
                            n = here_bits + 3;
                            while (bits < n) {
                                if (have === 0) { break inf_leave; }
                                have--;
                                hold += input[next++] << bits;
                                bits += 8;
                            }
                            //===//
                            //--- DROPBITS(here.bits) ---//
                            hold >>>= here_bits;
                            bits -= here_bits;
                            //---//
                            len = 0;
                            copy = 3 + (hold & 0x07);//BITS(3);
                            //--- DROPBITS(3) ---//
                            hold >>>= 3;
                            bits -= 3;
                            //---//
                        }
                        else {
                            //=== NEEDBITS(here.bits + 7);
                            n = here_bits + 7;
                            while (bits < n) {
                                if (have === 0) { break inf_leave; }
                                have--;
                                hold += input[next++] << bits;
                                bits += 8;
                            }
                            //===//
                            //--- DROPBITS(here.bits) ---//
                            hold >>>= here_bits;
                            bits -= here_bits;
                            //---//
                            len = 0;
                            copy = 11 + (hold & 0x7f);//BITS(7);
                            //--- DROPBITS(7) ---//
                            hold >>>= 7;
                            bits -= 7;
                            //---//
                        }
                        if (state.have + copy > state.nlen + state.ndist) {
                            strm.msg = 'invalid bit length repeat';
                            state.mode = BAD$1;
                            break;
                        }
                        while (copy--) {
                            state.lens[state.have++] = len;
                        }
                    }
                }

                /* handle error breaks in while */
                if (state.mode === BAD$1) { break; }

                /* check for end-of-block code (better have one) */
                if (state.lens[256] === 0) {
                    strm.msg = 'invalid code -- missing end-of-block';
                    state.mode = BAD$1;
                    break;
                }

                /* build code tables -- note: do not change the lenbits or distbits
                   values here (9 and 6) without reading the comments in inftrees.h
                   concerning the ENOUGH constants, which depend on those values */
                state.lenbits = 9;

                opts = { bits: state.lenbits };
                ret = inftrees(LENS$1, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
                // We have separate tables & no pointers. 2 commented lines below not needed.
                // state.next_index = opts.table_index;
                state.lenbits = opts.bits;
                // state.lencode = state.next;

                if (ret) {
                    strm.msg = 'invalid literal/lengths set';
                    state.mode = BAD$1;
                    break;
                }

                state.distbits = 6;
                //state.distcode.copy(state.codes);
                // Switch to use dynamic table
                state.distcode = state.distdyn;
                opts = { bits: state.distbits };
                ret = inftrees(DISTS$1, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
                // We have separate tables & no pointers. 2 commented lines below not needed.
                // state.next_index = opts.table_index;
                state.distbits = opts.bits;
                // state.distcode = state.next;

                if (ret) {
                    strm.msg = 'invalid distances set';
                    state.mode = BAD$1;
                    break;
                }
                //Tracev((stderr, 'inflate:       codes ok\n'));
                state.mode = LEN_;
                if (flush === Z_TREES) { break inf_leave; }
                /* falls through */
            case LEN_:
                state.mode = LEN;
                /* falls through */
            case LEN:
                if (have >= 6 && left >= 258) {
                    //--- RESTORE() ---
                    strm.next_out = put;
                    strm.avail_out = left;
                    strm.next_in = next;
                    strm.avail_in = have;
                    state.hold = hold;
                    state.bits = bits;
                    //---
                    inffast(strm, _out);
                    //--- LOAD() ---
                    put = strm.next_out;
                    output = strm.output;
                    left = strm.avail_out;
                    next = strm.next_in;
                    input = strm.input;
                    have = strm.avail_in;
                    hold = state.hold;
                    bits = state.bits;
                    //---

                    if (state.mode === TYPE$1) {
                        state.back = -1;
                    }
                    break;
                }
                state.back = 0;
                for (;;) {
                    here = state.lencode[hold & ((1 << state.lenbits) - 1)];  /*BITS(state.lenbits)*/
                    here_bits = here >>> 24;
                    here_op = (here >>> 16) & 0xff;
                    here_val = here & 0xffff;

                    if (here_bits <= bits) { break; }
                    //--- PULLBYTE() ---//
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                    //---//
                }
                if (here_op && (here_op & 0xf0) === 0) {
                    last_bits = here_bits;
                    last_op = here_op;
                    last_val = here_val;
                    for (;;) {
                        here = state.lencode[last_val +
                                             ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
                        here_bits = here >>> 24;
                        here_op = (here >>> 16) & 0xff;
                        here_val = here & 0xffff;

                        if ((last_bits + here_bits) <= bits) { break; }
                        //--- PULLBYTE() ---//
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                        //---//
                    }
                    //--- DROPBITS(last.bits) ---//
                    hold >>>= last_bits;
                    bits -= last_bits;
                    //---//
                    state.back += last_bits;
                }
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                state.back += here_bits;
                state.length = here_val;
                if (here_op === 0) {
                    //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
                    //        "inflate:         literal '%c'\n" :
                    //        "inflate:         literal 0x%02x\n", here.val));
                    state.mode = LIT;
                    break;
                }
                if (here_op & 32) {
                    //Tracevv((stderr, "inflate:         end of block\n"));
                    state.back = -1;
                    state.mode = TYPE$1;
                    break;
                }
                if (here_op & 64) {
                    strm.msg = 'invalid literal/length code';
                    state.mode = BAD$1;
                    break;
                }
                state.extra = here_op & 15;
                state.mode = LENEXT;
                /* falls through */
            case LENEXT:
                if (state.extra) {
                    //=== NEEDBITS(state.extra);
                    n = state.extra;
                    while (bits < n) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    state.length += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
                    //--- DROPBITS(state.extra) ---//
                    hold >>>= state.extra;
                    bits -= state.extra;
                    //---//
                    state.back += state.extra;
                }
                //Tracevv((stderr, "inflate:         length %u\n", state.length));
                state.was = state.length;
                state.mode = DIST;
                /* falls through */
            case DIST:
                for (;;) {
                    here = state.distcode[hold & ((1 << state.distbits) - 1)];/*BITS(state.distbits)*/
                    here_bits = here >>> 24;
                    here_op = (here >>> 16) & 0xff;
                    here_val = here & 0xffff;

                    if ((here_bits) <= bits) { break; }
                    //--- PULLBYTE() ---//
                    if (have === 0) { break inf_leave; }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                    //---//
                }
                if ((here_op & 0xf0) === 0) {
                    last_bits = here_bits;
                    last_op = here_op;
                    last_val = here_val;
                    for (;;) {
                        here = state.distcode[last_val +
                                              ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
                        here_bits = here >>> 24;
                        here_op = (here >>> 16) & 0xff;
                        here_val = here & 0xffff;

                        if ((last_bits + here_bits) <= bits) { break; }
                        //--- PULLBYTE() ---//
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                        //---//
                    }
                    //--- DROPBITS(last.bits) ---//
                    hold >>>= last_bits;
                    bits -= last_bits;
                    //---//
                    state.back += last_bits;
                }
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                state.back += here_bits;
                if (here_op & 64) {
                    strm.msg = 'invalid distance code';
                    state.mode = BAD$1;
                    break;
                }
                state.offset = here_val;
                state.extra = (here_op) & 15;
                state.mode = DISTEXT;
                /* falls through */
            case DISTEXT:
                if (state.extra) {
                    //=== NEEDBITS(state.extra);
                    n = state.extra;
                    while (bits < n) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    state.offset += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
                    //--- DROPBITS(state.extra) ---//
                    hold >>>= state.extra;
                    bits -= state.extra;
                    //---//
                    state.back += state.extra;
                }
                //#ifdef INFLATE_STRICT
                if (state.offset > state.dmax) {
                    strm.msg = 'invalid distance too far back';
                    state.mode = BAD$1;
                    break;
                }
                //#endif
                //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
                state.mode = MATCH;
                /* falls through */
            case MATCH:
                if (left === 0) { break inf_leave; }
                copy = _out - left;
                if (state.offset > copy) {         /* copy from window */
                    copy = state.offset - copy;
                    if (copy > state.whave) {
                        if (state.sane) {
                            strm.msg = 'invalid distance too far back';
                            state.mode = BAD$1;
                            break;
                        }
                        // (!) This block is disabled in zlib defaults,
                        // don't enable it for binary compatibility
                        //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                        //          Trace((stderr, "inflate.c too far\n"));
                        //          copy -= state.whave;
                        //          if (copy > state.length) { copy = state.length; }
                        //          if (copy > left) { copy = left; }
                        //          left -= copy;
                        //          state.length -= copy;
                        //          do {
                        //            output[put++] = 0;
                        //          } while (--copy);
                        //          if (state.length === 0) { state.mode = LEN; }
                        //          break;
                        //#endif
                    }
                    if (copy > state.wnext) {
                        copy -= state.wnext;
                        from = state.wsize - copy;
                    }
                    else {
                        from = state.wnext - copy;
                    }
                    if (copy > state.length) { copy = state.length; }
                    from_source = state.window;
                }
                else {                              /* copy from output */
                    from_source = output;
                    from = put - state.offset;
                    copy = state.length;
                }
                if (copy > left) { copy = left; }
                left -= copy;
                state.length -= copy;
                do {
                    output[put++] = from_source[from++];
                } while (--copy);
                if (state.length === 0) { state.mode = LEN; }
                break;
            case LIT:
                if (left === 0) { break inf_leave; }
                output[put++] = state.length;
                left--;
                state.mode = LEN;
                break;
            case CHECK:
                if (state.wrap) {
                    //=== NEEDBITS(32);
                    while (bits < 32) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        // Use '|' instead of '+' to make sure that result is signed
                        hold |= input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    _out -= left;
                    strm.total_out += _out;
                    state.total += _out;
                    if (_out) {
                        strm.adler = state.check =
                            /*UPDATE(state.check, put - _out, _out);*/
                        (state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out));

                    }
                    _out = left;
                    // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
                    if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                        strm.msg = 'incorrect data check';
                        state.mode = BAD$1;
                        break;
                    }
                    //=== INITBITS();
                    hold = 0;
                    bits = 0;
                    //===//
                    //Tracev((stderr, "inflate:   check matches trailer\n"));
                }
                state.mode = LENGTH;
                /* falls through */
            case LENGTH:
                if (state.wrap && state.flags) {
                    //=== NEEDBITS(32);
                    while (bits < 32) {
                        if (have === 0) { break inf_leave; }
                        have--;
                        hold += input[next++] << bits;
                        bits += 8;
                    }
                    //===//
                    if (hold !== (state.total & 0xffffffff)) {
                        strm.msg = 'incorrect length check';
                        state.mode = BAD$1;
                        break;
                    }
                    //=== INITBITS();
                    hold = 0;
                    bits = 0;
                    //===//
                    //Tracev((stderr, "inflate:   length matches trailer\n"));
                }
                state.mode = DONE;
                /* falls through */
            case DONE:
                ret = Z_STREAM_END;
                break inf_leave;
            case BAD$1:
                ret = Z_DATA_ERROR;
                break inf_leave;
            case MEM:
                return Z_MEM_ERROR;
            case SYNC:
                /* falls through */
            default:
                return Z_STREAM_ERROR;
        }
    }

    // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

    /*
      Return from inflate(), updating the total counts and the check value.
      If there was no progress during the inflate() call, return a buffer
      error.  Call updatewindow() to create and/or update the window state.
      Note: a memory error from inflate() is non-recoverable.
    */

    //--- RESTORE() ---
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    //---

    if (state.wsize || (_out !== strm.avail_out && state.mode < BAD$1 &&
                        (state.mode < CHECK || flush !== Z_FINISH))) {
        if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
            state.mode = MEM;
            return Z_MEM_ERROR;
        }
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap && _out) {
        strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
        (state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out));
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) +
        (state.mode === TYPE$1 ? 128 : 0) +
        (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if (((_in === 0 && _out === 0) || flush === Z_FINISH) && ret === Z_OK) {
        ret = Z_BUF_ERROR;
    }
    return ret;
}

function inflateEnd(strm) {

    if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
        return Z_STREAM_ERROR;
    }

    var state = strm.state;
    if (state.window) {
        state.window = null;
    }
    strm.state = null;
    return Z_OK;
}

function inflateGetHeader(strm, head) {
    var state;

    /* check state */
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR; }

    /* save header structure */
    state.head = head;
    head.done = false;
    return Z_OK;
}

function inflateSetDictionary(strm, dictionary) {
    var dictLength = dictionary.length;

    var state;
    var dictid;
    var ret;

    /* check state */
    if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) { return Z_STREAM_ERROR; }
    state = strm.state;

    if (state.wrap !== 0 && state.mode !== DICT) {
        return Z_STREAM_ERROR;
    }

    /* check for correct dictionary identifier */
    if (state.mode === DICT) {
        dictid = 1; /* adler32(0, null, 0)*/
        /* dictid = adler32(dictid, dictionary, dictLength); */
        dictid = adler32_1(dictid, dictionary, dictLength, 0);
        if (dictid !== state.check) {
            return Z_DATA_ERROR;
        }
    }
    /* copy dictionary to window using updatewindow(), which will amend the
       existing dictionary if appropriate */
    ret = updatewindow(strm, dictionary, dictLength, dictLength);
    if (ret) {
        state.mode = MEM;
        return Z_MEM_ERROR;
    }
    state.havedict = 1;
    // Tracev((stderr, "inflate:   dictionary set\n"));
    return Z_OK;
}

var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2 = inflate;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
   exports.inflateCopy = inflateCopy;
   exports.inflateGetDictionary = inflateGetDictionary;
   exports.inflateMark = inflateMark;
   exports.inflatePrime = inflatePrime;
   exports.inflateSync = inflateSync;
   exports.inflateSyncPoint = inflateSyncPoint;
   exports.inflateUndermine = inflateUndermine;
*/

var inflate_1 = {
    inflateReset: inflateReset_1,
    inflateReset2: inflateReset2_1,
    inflateResetKeep: inflateResetKeep_1,
    inflateInit: inflateInit_1,
    inflateInit2: inflateInit2_1,
    inflate: inflate_2,
    inflateEnd: inflateEnd_1,
    inflateGetHeader: inflateGetHeader_1,
    inflateSetDictionary: inflateSetDictionary_1,
    inflateInfo: inflateInfo
};

// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
var STR_APPLY_OK = true;
var STR_APPLY_UIA_OK = true;

try { String.fromCharCode.apply(null, [ 0 ]); } catch (__) { STR_APPLY_OK = false; }
try { String.fromCharCode.apply(null, new Uint8Array(1)); } catch (__) { STR_APPLY_UIA_OK = false; }


// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
var _utf8len = new common.Buf8(256);
for (var q = 0; q < 256; q++) {
    _utf8len[q] = (q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1);
}
_utf8len[254] = _utf8len[254] = 1; // Invalid sequence start


// convert string to array (typed, when possible)
var string2buf = function (str) {
    var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;

    // count binary size
    for (m_pos = 0; m_pos < str_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
            c2 = str.charCodeAt(m_pos + 1);
            if ((c2 & 0xfc00) === 0xdc00) {
                c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                m_pos++;
            }
        }
        buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }

    // allocate buffer
    buf = new common.Buf8(buf_len);

    // convert
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
            c2 = str.charCodeAt(m_pos + 1);
            if ((c2 & 0xfc00) === 0xdc00) {
                c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                m_pos++;
            }
        }
        if (c < 0x80) {
            /* one byte */
            buf[i++] = c;
        } else if (c < 0x800) {
            /* two bytes */
            buf[i++] = 0xC0 | (c >>> 6);
            buf[i++] = 0x80 | (c & 0x3f);
        } else if (c < 0x10000) {
            /* three bytes */
            buf[i++] = 0xE0 | (c >>> 12);
            buf[i++] = 0x80 | (c >>> 6 & 0x3f);
            buf[i++] = 0x80 | (c & 0x3f);
        } else {
            /* four bytes */
            buf[i++] = 0xf0 | (c >>> 18);
            buf[i++] = 0x80 | (c >>> 12 & 0x3f);
            buf[i++] = 0x80 | (c >>> 6 & 0x3f);
            buf[i++] = 0x80 | (c & 0x3f);
        }
    }

    return buf;
};

// Helper (used in 2 places)
function buf2binstring(buf, len) {
    // use fallback for big arrays to avoid stack overflow
    if (len < 65537) {
        if ((buf.subarray && STR_APPLY_UIA_OK) || (!buf.subarray && STR_APPLY_OK)) {
            return String.fromCharCode.apply(null, common.shrinkBuf(buf, len));
        }
    }

    var result = '';
    for (var i = 0; i < len; i++) {
        result += String.fromCharCode(buf[i]);
    }
    return result;
}


// Convert byte array to binary string
var buf2binstring_1 = function (buf) {
    return buf2binstring(buf, buf.length);
};


// Convert binary string (typed, when possible)
var binstring2buf = function (str) {
    var buf = new common.Buf8(str.length);
    for (var i = 0, len = buf.length; i < len; i++) {
        buf[i] = str.charCodeAt(i);
    }
    return buf;
};


// convert array to string
var buf2string = function (buf, max) {
    var i, out, c, c_len;
    var len = max || buf.length;

    // Reserve max possible length (2 words per char)
    // NB: by unknown reasons, Array is significantly faster for
    //     String.fromCharCode.apply than Uint16Array.
    var utf16buf = new Array(len * 2);

    for (out = 0, i = 0; i < len;) {
        c = buf[i++];
        // quick process ascii
        if (c < 0x80) { utf16buf[out++] = c; continue; }

        c_len = _utf8len[c];
        // skip 5 & 6 byte codes
        if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len - 1; continue; }

        // apply mask on first byte
        c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
        // join the rest
        while (c_len > 1 && i < len) {
            c = (c << 6) | (buf[i++] & 0x3f);
            c_len--;
        }

        // terminated by end of string?
        if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }

        if (c < 0x10000) {
            utf16buf[out++] = c;
        } else {
            c -= 0x10000;
            utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
            utf16buf[out++] = 0xdc00 | (c & 0x3ff);
        }
    }

    return buf2binstring(utf16buf, out);
};


// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
var utf8border = function (buf, max) {
    var pos;

    max = max || buf.length;
    if (max > buf.length) { max = buf.length; }

    // go back from last position, until start of sequence found
    pos = max - 1;
    while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }

    // Very small and broken sequence,
    // return max, because we should return something anyway.
    if (pos < 0) { return max; }

    // If we came to start of buffer - that means buffer is too small,
    // return max too.
    if (pos === 0) { return max; }

    return (pos + _utf8len[buf[pos]] > max) ? pos : max;
};

var strings = {
    string2buf: string2buf,
    buf2binstring: buf2binstring_1,
    binstring2buf: binstring2buf,
    buf2string: buf2string,
    utf8border: utf8border
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var constants = {

    /* Allowed flush values; see deflate() and inflate() below for details */
    Z_NO_FLUSH:         0,
    Z_PARTIAL_FLUSH:    1,
    Z_SYNC_FLUSH:       2,
    Z_FULL_FLUSH:       3,
    Z_FINISH:           4,
    Z_BLOCK:            5,
    Z_TREES:            6,

    /* Return codes for the compression/decompression functions. Negative values
     * are errors, positive values are used for special but normal events.
     */
    Z_OK:               0,
    Z_STREAM_END:       1,
    Z_NEED_DICT:        2,
    Z_ERRNO:           -1,
    Z_STREAM_ERROR:    -2,
    Z_DATA_ERROR:      -3,
    //Z_MEM_ERROR:     -4,
    Z_BUF_ERROR:       -5,
    //Z_VERSION_ERROR: -6,

    /* compression levels */
    Z_NO_COMPRESSION:         0,
    Z_BEST_SPEED:             1,
    Z_BEST_COMPRESSION:       9,
    Z_DEFAULT_COMPRESSION:   -1,


    Z_FILTERED:               1,
    Z_HUFFMAN_ONLY:           2,
    Z_RLE:                    3,
    Z_FIXED:                  4,
    Z_DEFAULT_STRATEGY:       0,

    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY:                 0,
    Z_TEXT:                   1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN:                2,

    /* The deflate compression method */
    Z_DEFLATED:               8
    //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var messages = {
    2:      'need dictionary',     /* Z_NEED_DICT       2  */
    1:      'stream end',          /* Z_STREAM_END      1  */
    0:      '',                    /* Z_OK              0  */
    '-1':   'file error',          /* Z_ERRNO         (-1) */
    '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
    '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
    '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
    '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
    '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
    /* next input byte */
    this.input = null; // JS specific, because we have no pointers
    this.next_in = 0;
    /* number of bytes available at input */
    this.avail_in = 0;
    /* total number of input bytes read so far */
    this.total_in = 0;
    /* next output byte should be put there */
    this.output = null; // JS specific, because we have no pointers
    this.next_out = 0;
    /* remaining free space at output */
    this.avail_out = 0;
    /* total number of bytes output so far */
    this.total_out = 0;
    /* last error message, NULL if no error */
    this.msg = ''/*Z_NULL*/;
    /* not visible by applications */
    this.state = null;
    /* best guess about the data type: binary or text */
    this.data_type = 2/*Z_UNKNOWN*/;
    /* adler32 value of the uncompressed data */
    this.adler = 0;
}

var zstream = ZStream;

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader() {
    /* true if compressed data believed to be text */
    this.text       = 0;
    /* modification time */
    this.time       = 0;
    /* extra flags (not used when writing a gzip file) */
    this.xflags     = 0;
    /* operating system */
    this.os         = 0;
    /* pointer to extra field or Z_NULL if none */
    this.extra      = null;
    /* extra field length (valid if extra != Z_NULL) */
    this.extra_len  = 0; // Actually, we don't need it in JS,
    // but leave for few code modifications

    //
    // Setup limits is not necessary because in js we should not preallocate memory
    // for inflate use constant limit in 65536 bytes
    //

    /* space at extra (only when reading header) */
    // this.extra_max  = 0;
    /* pointer to zero-terminated file name or Z_NULL */
    this.name       = '';
    /* space at name (only when reading header) */
    // this.name_max   = 0;
    /* pointer to zero-terminated comment or Z_NULL */
    this.comment    = '';
    /* space at comment (only when reading header) */
    // this.comm_max   = 0;
    /* true if there was or will be a header crc */
    this.hcrc       = 0;
    /* true when done reading gzip header (not used when writing a gzip file) */
    this.done       = false;
}

var gzheader = GZheader;

var toString = Object.prototype.toString;

/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param) or if you
 * push a chunk with explicit flush (call [[Inflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/


/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate(options) {
    if (!(this instanceof Inflate)) return new Inflate(options);

    this.options = common.assign({
        chunkSize: 16384,
        windowBits: 0,
        to: ''
    }, options || {});

    var opt = this.options;

    // Force window size for `raw` data, if not set directly,
    // because we have no header for autodetect.
    if (opt.raw && (opt.windowBits >= 0) && (opt.windowBits < 16)) {
        opt.windowBits = -opt.windowBits;
        if (opt.windowBits === 0) { opt.windowBits = -15; }
    }

    // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
    if ((opt.windowBits >= 0) && (opt.windowBits < 16) &&
        !(options && options.windowBits)) {
        opt.windowBits += 32;
    }

    // Gzip header has no info about windows size, we can do autodetect only
    // for deflate. So, if window size not set, force it to max when gzip possible
    if ((opt.windowBits > 15) && (opt.windowBits < 48)) {
        // bit 3 (16) -> gzipped data
        // bit 4 (32) -> autodetect gzip/deflate
        if ((opt.windowBits & 15) === 0) {
            opt.windowBits |= 15;
        }
    }

    this.err    = 0;      // error code, if happens (0 = Z_OK)
    this.msg    = '';     // error message
    this.ended  = false;  // used to avoid multiple onEnd() calls
    this.chunks = [];     // chunks of compressed data

    this.strm   = new zstream();
    this.strm.avail_out = 0;

    var status  = inflate_1.inflateInit2(
        this.strm,
        opt.windowBits
    );

    if (status !== constants.Z_OK) {
        throw new Error(messages[status]);
    }

    this.header = new gzheader();

    inflate_1.inflateGetHeader(this.strm, this.header);
}

/**
 * Inflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Inflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the decompression context.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate.prototype.push = function (data, mode) {
    var strm = this.strm;
    var chunkSize = this.options.chunkSize;
    var dictionary = this.options.dictionary;
    var status, _mode;
    var next_out_utf8, tail, utf8str;
    var dict;

    // Flag to properly process Z_BUF_ERROR on testing inflate call
    // when we check that all output data was flushed.
    var allowBufError = false;

    if (this.ended) { return false; }
    _mode = (mode === ~~mode) ? mode : ((mode === true) ? constants.Z_FINISH : constants.Z_NO_FLUSH);

    // Convert data if needed
    if (typeof data === 'string') {
        // Only binary strings can be decompressed on practice
        strm.input = strings.binstring2buf(data);
    } else if (toString.call(data) === '[object ArrayBuffer]') {
        strm.input = new Uint8Array(data);
    } else {
        strm.input = data;
    }

    strm.next_in = 0;
    strm.avail_in = strm.input.length;

    do {
        if (strm.avail_out === 0) {
            strm.output = new common.Buf8(chunkSize);
            strm.next_out = 0;
            strm.avail_out = chunkSize;
        }

        status = inflate_1.inflate(strm, constants.Z_NO_FLUSH);    /* no bad return value */

        if (status === constants.Z_NEED_DICT && dictionary) {
            // Convert data if needed
            if (typeof dictionary === 'string') {
                dict = strings.string2buf(dictionary);
            } else if (toString.call(dictionary) === '[object ArrayBuffer]') {
                dict = new Uint8Array(dictionary);
            } else {
                dict = dictionary;
            }

            status = inflate_1.inflateSetDictionary(this.strm, dict);

        }

        if (status === constants.Z_BUF_ERROR && allowBufError === true) {
            status = constants.Z_OK;
            allowBufError = false;
        }

        if (status !== constants.Z_STREAM_END && status !== constants.Z_OK) {
            this.onEnd(status);
            this.ended = true;
            return false;
        }

        if (strm.next_out) {
            if (strm.avail_out === 0 || status === constants.Z_STREAM_END || (strm.avail_in === 0 && (_mode === constants.Z_FINISH || _mode === constants.Z_SYNC_FLUSH))) {

                if (this.options.to === 'string') {

                    next_out_utf8 = strings.utf8border(strm.output, strm.next_out);

                    tail = strm.next_out - next_out_utf8;
                    utf8str = strings.buf2string(strm.output, next_out_utf8);

                    // move tail
                    strm.next_out = tail;
                    strm.avail_out = chunkSize - tail;
                    if (tail) { common.arraySet(strm.output, strm.output, next_out_utf8, tail, 0); }

                    this.onData(utf8str);

                } else {
                    this.onData(common.shrinkBuf(strm.output, strm.next_out));
                }
            }
        }

        // When no more input data, we should check that internal inflate buffers
        // are flushed. The only way to do it when avail_out = 0 - run one more
        // inflate pass. But if output data not exists, inflate return Z_BUF_ERROR.
        // Here we set flag to process this error properly.
        //
        // NOTE. Deflate does not return error in this case and does not needs such
        // logic.
        if (strm.avail_in === 0 && strm.avail_out === 0) {
            allowBufError = true;
        }

    } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== constants.Z_STREAM_END);

    if (status === constants.Z_STREAM_END) {
        _mode = constants.Z_FINISH;
    }

    // Finalize on the last chunk.
    if (_mode === constants.Z_FINISH) {
        status = inflate_1.inflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === constants.Z_OK;
    }

    // callback interim results if Z_SYNC_FLUSH.
    if (_mode === constants.Z_SYNC_FLUSH) {
        this.onEnd(constants.Z_OK);
        strm.avail_out = 0;
        return true;
    }

    return true;
};


/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): output data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate.prototype.onData = function (chunk) {
    this.chunks.push(chunk);
};


/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate.prototype.onEnd = function (status) {
    // On success - join
    if (status === constants.Z_OK) {
        if (this.options.to === 'string') {
            // Glue & convert here, until we teach pako to send
            // utf8 aligned strings to onData
            this.result = this.chunks.join('');
        } else {
            this.result = common.flattenChunks(this.chunks);
        }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
};


/**
 * inflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , input = pako.deflate([1,2,3,4,5,6,7,8,9])
 *   , output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err)
 *   console.log(err);
 * }
 * ```
 **/
function inflate$1(input, options) {
    var inflator = new Inflate(options);

    inflator.push(input, true);

    // That will never happens, if you don't cheat with options :)
    if (inflator.err) { throw inflator.msg || messages[inflator.err]; }

    return inflator.result;
}


/**
 * inflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw(input, options) {
    options = options || {};
    options.raw = true;
    return inflate$1(input, options);
}


/**
 * ungzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/


var Inflate_1 = Inflate;
var inflate_2$1 = inflate$1;
var inflateRaw_1 = inflateRaw;
var ungzip  = inflate$1;

var inflate_1$1 = {
    Inflate: Inflate_1,
    inflate: inflate_2$1,
    inflateRaw: inflateRaw_1,
    ungzip: ungzip
};

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LITTLE_ENDIAN = true;

var BufferReader = function () {
    function BufferReader(buffer) {
        _classCallCheck(this, BufferReader);

        this.dataView = new DataView(buffer);
        this.position = 0;
    }

    BufferReader.prototype.skip = function skip(length) {

        this.position += length;
    };

    BufferReader.prototype.readBytes = function readBytes(length) {

        var type = length === 4 ? 'getUint32' : length === 2 ? 'getUint16' : 'getUint8';
        var start = this.position;
        // console.log('start', start);
        // console.log('length', length); 
        // console.log('this.dataView[type](start, LITTLE_ENDIAN)', this.dataView[type](start, LITTLE_ENDIAN)); 
        this.position += length;
        return this.dataView[type](start, LITTLE_ENDIAN);
    };

    BufferReader.prototype.readBytesWithoutPositionChange = function readBytesWithoutPositionChange(offset, length) {
        var type = length === 4 ? 'getUint32' : length === 2 ? 'getUint16' : 'getUint8';
        return this.dataView[type](offset, LITTLE_ENDIAN);
    };
    
    return BufferReader;
}();

var LOCAL_FILE_HEADER = 0x04034b50;
var CENTRAL_DIRECTORY = 0x02014b50;
// const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const LOCAL_FILE_FIXED_HEADER_SIZE = 30;
const SIGNATURE_FIELD_SIZE = 4;
const OFFSET_OF_FIELD_COMPRESSED_SIZE__FROM_BEGINING_OF_LOCAL_FILE = 18;
const OFFSET_OF_FIELD_FILENAME__FROM_BEGINING_OF_LOCAL_FILE = 26;
const OFFSET_OF_FIELD_EXTRA__FROM_BEGINING_OF_LOCAL_FILE = 28;

// avner:
// the offset is relative to the beginning of the buffer
// which may be a slice of a bigger buffer
var parseZip = function parseZip(buffer, doSkipFileData)
{
    // console.log('BEG parseZip');
    
    var reader = new BufferReader(buffer);

    const bufferSizeInBytes = buffer.byteLength;
    // console.log('bufferSizeInBytes', bufferSizeInBytes);
    
    var files = {};
    let numBytesRead = 0;

    // Parse multiple zip entries in the zip file
    while (true) {

        var zipEntryBegPosition = reader.position;
        numBytesRead = zipEntryBegPosition;

        if(zipEntryBegPosition + SIGNATURE_FIELD_SIZE > bufferSizeInBytes)
        {
            // reading the fixed portion of the header will overflow the buffer
            // previous files info is valid but not the current file
            break;
        }
        
        var signature = reader.readBytes(4);
        // console.log('signature', signature);
        // console.log('bufferSizeInBytes', bufferSizeInBytes);
        
        if (signature === LOCAL_FILE_HEADER) {

            if(zipEntryBegPosition + LOCAL_FILE_FIXED_HEADER_SIZE > bufferSizeInBytes)
            {
                // reading the fixed portion of the header will overflow the buffer
                // previous files info is valid but not the current file
                break;
            }

            // read the length of the filename field (without changing the position of the reader),
            // just to see if we can actually read the header
            let byteOffset = zipEntryBegPosition + OFFSET_OF_FIELD_FILENAME__FROM_BEGINING_OF_LOCAL_FILE;
            let numBytesToRead = 2;
            let filenameFieldLength = reader.readBytesWithoutPositionChange(byteOffset, numBytesToRead)

            // read the length of the extra field (without changing the position of the reader),
            // just to see if we can actually read the header
            byteOffset = zipEntryBegPosition + OFFSET_OF_FIELD_EXTRA__FROM_BEGINING_OF_LOCAL_FILE;
            let extraFieldLength = reader.readBytesWithoutPositionChange(byteOffset, numBytesToRead)

            let headerSize = LOCAL_FILE_FIXED_HEADER_SIZE + filenameFieldLength + extraFieldLength;

            byteOffset = zipEntryBegPosition + OFFSET_OF_FIELD_COMPRESSED_SIZE__FROM_BEGINING_OF_LOCAL_FILE;
            let compressedSize = reader.readBytesWithoutPositionChange(byteOffset, numBytesToRead)
            
            if(zipEntryBegPosition + headerSize + compressedSize > bufferSizeInBytes)
            {
                // reading the next local file (header and data) will overflow the buffer
                // previous files info is valid but not the current file
                break;
            }

            // read the file header
            var fileHeader = parseLocalFileHeader(reader);

            files[fileHeader.filename] = { filename: fileHeader.filename,
                                           offsetInZipFile: fileHeader.offset,
                                           headerSize: fileHeader.headerSize,
                                           compressedSize: fileHeader.compressedSize,
                                           buffer: null };
            
            if(doSkipFileData)
            {
                // skip by the size of the current file, to be positioned at the header of the next file
                // (to be ready for the next call)
                reader.skip(fileHeader.compressedSize);
            }
            else
            {
                let data = parseLocalFileDataBuffer(reader,
                                                    fileHeader.compressedSize,
                                                    fileHeader.compression,
                                                    fileHeader.filename);

                
                files[fileHeader.filename].buffer = data;
            }
            numBytesRead = reader.position;

            continue;
        }
        else if (signature === CENTRAL_DIRECTORY) {
            parseCentralDirectory(reader);
            numBytesRead = reader.position;
            continue;
        }
        else
        {
            // should not get here
            console.error('Failed to read the next zip entry. The signature is invalid');
            break;
        }
    }
    
    return {files: files,
            numBytesRead: numBytesRead};

};

// # Local file header
// 
// | Offset |  Length  | Contents                                 |
// | ------ | -------- | ---------------------------------------- |
// |   0    |  4 bytes | Local file header signature (0x04034b50) |
// |   4    |  2 bytes | Version needed to extract                |
// |   6    |  2 bytes | General purpose bit flag                 |
// |   8    |  2 bytes | Compression method                       |
// |  10    |  2 bytes | Last mod file time                       |
// |  12    |  2 bytes | Last mod file date                       |
// |  14    |  4 bytes | CRC-32                                   |
// |  18    |  4 bytes | Compressed size (n)                      |
// |  22    |  4 bytes | Uncompressed size                        |
// |  26    |  2 bytes | Filename length (f)                      |
// |  28    |  2 bytes | Extra field length (e)                   |
// |        | (f)bytes | Filename                                 |
// |        | (e)bytes | Extra field                              |
// |        | (n)bytes | Compressed data                          |
var parseLocalFileHeader = function parseLocalFileHeader(reader) {

    var i = 0;
    let offsetInZipFile = reader.position - SIGNATURE_FIELD_SIZE;

    // -- position from beginning of the local file is 4 (after 4 bytes of field signature)
    // var data = void 0;
    reader.skip(4);
    // const version          = reader.readBytes( 2 );
    // const bitFlag          = reader.readBytes( 2 );
    var compression = reader.readBytes(2);
    reader.skip(8);
    // const lastModTime      = reader.readBytes( 2 );
    // const lastModDate      = reader.readBytes( 2 );
    // const crc32            = reader.readBytes( 4 );

    // -- position from beginning of the local file is 18
    var compressedSize = reader.readBytes(4);
    reader.skip(4);
    // const uncompressedSize = reader.readBytes( 4 );
    // -- position from beginning of the local file is 26
    var filenameLength = reader.readBytes(2);
    var extraFieldLength = reader.readBytes(2);
    // -- position from beginning of the local file is 30

    var filename = [];
    // const extraField     = [];
    // var compressedData = new Uint8Array(compressedSize);

    for (i = 0; i < filenameLength; i++) {
        filename.push(String.fromCharCode(reader.readBytes(1)));
    }

    reader.skip(extraFieldLength);
    // for ( i = 0; i < extraFieldLength; i ++ ) {

    //     extraField.push( reader.readBytes( 1 ) );

    // }
    let headerSize = reader.position - offsetInZipFile;

    return {
        compression: compression,
        offset: offsetInZipFile,
        headerSize: headerSize,
        compressedSize: compressedSize,
        filename: filename.join('')
    };
};


var parseLocalFileDataBuffer = function parseLocalFileDataBuffer(reader,
                                                                 compressedSize,
                                                                 compression,
                                                                 filename) {
    var data = void 0;
    var i = 0;
    var compressedData = new Uint8Array(compressedSize);

    
    // avner - looks like this is what slows up big files (e.g. floor0_lg.zip)
    for (i = 0; i < compressedSize; i++) {
        // console.log('i', i); 
        compressedData[i] = reader.readBytes(1);
    }
    
    // console.log('compression method', compression); 
    switch (compression) {

        case 0:
            data = compressedData;
            break;
        case 8:
            data = new Uint8Array(inflate_1$1.inflate(compressedData, { raw: true }));
            break;
        default:
            console.log(filename + ': unsupported compression type');
            data = compressedData;
    }

    return data;
};


// # Central directory
//
// | Offset |  Length  | Contents                                   |
// | ------ | -------- | ------------------------------------------ |
// |   0    |  4 bytes | Central file header signature (0x02014b50) |
// |   4    |  2 bytes | Version made by                            |
// |   6    |  2 bytes | Version needed to extract                  |
// |   8    |  2 bytes | General purpose bit flag                   |
// |  10    |  2 bytes | Compression method                         |
// |  12    |  2 bytes | Last mod file time                         |
// |  14    |  2 bytes | Last mod file date                         |
// |  16    |  4 bytes | CRC-32                                     |
// |  20    |  4 bytes | Compressed size                            |
// |  24    |  4 bytes | Uncompressed size                          |
// |  28    |  2 bytes | Filename length (f)                        |
// |  30    |  2 bytes | Extra field length (e)                     |
// |  32    |  2 bytes | File comment length (c)                    |
// |  34    |  2 bytes | Disk number start                          |
// |  36    |  2 bytes | Internal file attributes                   |
// |  38    |  4 bytes | External file attributes                   |
// |  42    |  4 bytes | Relative offset of local header            |
// |  46    | (f)bytes | Filename                                   |
// |        | (e)bytes | Extra field                                |
// |        | (c)bytes | File comment                               |
var parseCentralDirectory = function parseCentralDirectory(reader) {

    // let i = 0;
    reader.skip(24);
    // const versionMadeby        = reader.readBytes( 2 );
    // const versionNeedToExtract = reader.readBytes( 2 );
    // const bitFlag              = reader.readBytes( 2 );
    // const compression          = reader.readBytes( 2 );
    // const lastModTime          = reader.readBytes( 2 );
    // const lastModDate          = reader.readBytes( 2 );
    // const crc32                = reader.readBytes( 4 );
    // const compressedSize       = reader.readBytes( 4 );
    // const uncompressedSize     = reader.readBytes( 4 );
    var filenameLength = reader.readBytes(2);
    var extraFieldLength = reader.readBytes(2);
    var fileCommentLength = reader.readBytes(2);
    reader.skip(12);
    // const diskNumberStart      = reader.readBytes( 2 );
    // const internalFileAttrs    = reader.readBytes( 2 );
    // const externalFileAttrs    = reader.readBytes( 4 );
    // const relativeOffset       = reader.readBytes( 4 );
    // const filename    = [];
    // const extraField  = [];
    // const fileComment = [];

    reader.skip(filenameLength);
    // for ( i = 0; i < filenameLength; i ++ ) {

    //     filename.push( String.fromCharCode( reader.readBytes( 1 ) ) );

    // }

    reader.skip(extraFieldLength);
    // for ( i = 0; i < extraFieldLength; i ++ ) {

    //     extraField.push( reader.readBytes( 1 ) );

    // }

    reader.skip(fileCommentLength);
    // for ( i = 0; i < fileCommentLength; i ++ ) {

    //     fileComment.push( reader.readBytes( 1 ) );

    // }
};

var isPromiseSuppoted = typeof Promise === 'function';
var PromiseLike$1 = isPromiseSuppoted ? Promise : function PromiseLike(executor) {
    _classCallCheck(this, PromiseLike);

    var callback = function callback() {};
    var resolve = function resolve() {
        callback();
    };
    executor(resolve);

    return {
        then: function then(_callback) {
            callback = _callback;
        }
    };
};

var count = 0;
var THREE = void 0;

var ZipLoader = function () {

    ZipLoader.unzip = async function unzip(arrayBuffer, doSkipFileData) {
        // console.log('BEG unzip');
        
        // use byteLength to check the size
        // const arrayBufferSizeInBytes = arrayBuffer.byteLength;
        // console.log('arrayBufferSizeInBytes', arrayBufferSizeInBytes);
        
        // printing arrayBuffer to the console directly, prevents Garbage Collection and causes memory to pile up
        // console.log('arrayBuffer', arrayBuffer);

        return new PromiseLike$1(function (resolve) {
            var zipLoader = new ZipLoader();
            let retval = parseZip(arrayBuffer, doSkipFileData);
            zipLoader.files = retval.files;
            zipLoader.numBytesRead = retval.numBytesRead;
            resolve(zipLoader);
        });
    };

    function ZipLoader(url) {
        _classCallCheck(this, ZipLoader);

        this._id = count;
        this._listeners = {};
        this.url = url;
        this.files = null;
        this.numBytesRead = 0;
        count++;
    }

    ZipLoader.prototype.load = function load() {
        var _this = this;

        return new PromiseLike$1(function (resolve) {

            var startTime = Date.now();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', _this.url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onprogress = function (e) {

                _this.dispatch({
                    type: 'progress',
                    loaded: e.loaded,
                    total: e.total,
                    elapsedTime: Date.now() - startTime
                });
            };

            xhr.onload = function () {

                _this.files = parseZip(xhr.response);
                _this.dispatch({
                    type: 'load',
                    elapsedTime: Date.now() - startTime
                });
                resolve();
            };

            xhr.send();
        });
    };

    ZipLoader.prototype.extractAsText = function extractAsText(filename) {

        var buffer = this.files[filename].buffer;

        if (typeof TextDecoder !== 'undefined') {

            return new TextDecoder().decode(buffer);
        }

        var str = '';

        for (var i = 0, l = buffer.length; i < l; i++) {

            str += String.fromCharCode(buffer[i]);
        }

        return decodeURIComponent(escape(str));
    };

    ZipLoader.prototype.extractAsJSON = function extractAsJSON(filename) {

        return JSON.parse(this.extractAsText(filename));
    };

    ZipLoader.prototype.loadThreeJSON = function loadThreeJSON(filename) {
        var _this2 = this;

        var json = this.extractAsJSON(filename);
        var dirName = filename.replace(/\/.+\.json$/, '/');
        var pattern = '__ziploader_' + this._id + '__';
        var regex = new RegExp(pattern);

        if (!THREE_Loader.Handlers.handlers.indexOf(regex) !== -1) {

            THREE_Loader.Handlers.add(regex, {
                load: function load(filename) {

                    return _this2.loadThreeTexture(filename.replace(regex, ''));
                }
            });
        }

        return THREE_JSONLoader.prototype.parse(json, pattern + dirName);
    };

    ZipLoader.prototype.loadThreeTexture = function loadThreeTexture(filename) {

        var texture = new THREE_Texture();
        var type = /\.jpg$/.test(filename) ? 'image/jpeg' : /\.png$/.test(filename) ? 'image/png' : /\.gif$/.test(filename) ? 'image/gif' : undefined;
        var blob = new Blob([this.files[filename].buffer], { type: type });

        var onload = function onload() {

            texture.needsUpdate = true;
            texture.image.removeEventListener('load', onload);
            URL.revokeObjectURL(texture.image.src);
        };

        texture.image = new Image();
        texture.image.addEventListener('load', onload);
        texture.image.src = URL.createObjectURL(blob);
        return texture;
    };

    ZipLoader.prototype.on = function on(type, listener) {

        if (!this._listeners[type]) {

            this._listeners[type] = [];
        }

        if (this._listeners[type].indexOf(listener) === -1) {

            this._listeners[type].push(listener);
        }
    };

    ZipLoader.prototype.off = function off(type, listener) {

        var listenerArray = this._listeners[type];

        if (!!listenerArray) {

            var index = listenerArray.indexOf(listener);

            if (index !== -1) {

                listenerArray.splice(index, 1);
            }
        }
    };

    ZipLoader.prototype.dispatch = function dispatch(event) {

        var listenerArray = this._listeners[event.type];

        if (!!listenerArray) {

            event.target = this;
            var length = listenerArray.length;

            for (var i = 0; i < length; i++) {

                listenerArray[i].call(this, event);
            }
        }
    };

    ZipLoader.prototype.clear = function clear(filename) {

        if (!!filename) {

            URL.revokeObjectURL(this.files[filename].url);
            delete this.files[filename];
            return;
        }

        for (var key in this.files) {

            URL.revokeObjectURL(this.files[key].url);
        }

        delete this.files;

        if (!!THREE) {

            var pattern = '__ziploader_' + this._id + '__';

            THREE_Loader.Handlers.handlers.some(function (el, i) {

                if (el instanceof RegExp && el.source === pattern) {

                    THREE_Loader.Handlers.handlers.splice(i, 2);
                    return true;
                }
            });
        }
    };

    ZipLoader.install = function install(option) {

        if (!!option.THREE) {

            THREE = option.THREE;
        }
    };

    return ZipLoader;
}();

export { ZipLoader };

