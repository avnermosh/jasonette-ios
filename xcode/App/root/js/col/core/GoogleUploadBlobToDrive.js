// upload.js, from https://github.com/googledrive/cors-upload-sample
// Contributors Steve Bazyl, Mike Procopio, Jeffrey Posnick, Renaud Sauvain
// License: Apache 2.0 http://www.apache.org/licenses/LICENSE-2.0
//
// Implements Resumable Upload for Google Drive as described by
// https://developers.google.com/drive/v3/web/resumable-upload
//
// Modified by Paul Brewer, Economic and Financial Technology Consulting LLC
// Nov. 1 2017
//  1. use Google Drive API V3 instead of V2
//  2. wrap code in a "use strict" IIFE, only exposing MediaUploader
//  3. explicitly export MediaUploader as window.UploaderForGoogleDrive
//  4. if options.token undefined, get access token from existing window.gapi instance, if any
//
// Nov. 7, 2017
//  5. Change file metadata "title" to "name" in line with Drive API v2-->v3 migration advisory
//  6. export promise wrapper as window.pUploaderForGoogleDrive

// jshint browser:true, strict:true

'use strict';

window.UploaderForGoogleDrive = (function(){
    "use strict";

    /**
     * Helper for implementing retries with backoff. Initial retry
     * delay is 1 second, increasing by 2x (+jitter) for subsequent retries
     *
     * @constructor
     */

    var RetryHandler = function() {
	this.interval = 1000; // Start at one second
	this.maxInterval = 60 * 1000; // Don't wait longer than a minute 
    };

    /**
     * Invoke the function after waiting
     *
     * @param {function} fn Function to invoke
     */
    RetryHandler.prototype.retry = function(fn) {
	setTimeout(fn, this.interval);
	this.interval = this.nextInterval_();
    };

    /**
     * Reset the counter (e.g. after successful request.)
     */
    RetryHandler.prototype.reset = function() {
	this.interval = 1000;
    };

    /**
     * Calculate the next wait time.
     * @return {number} Next wait interval, in milliseconds
     *
     * @private
     */
    RetryHandler.prototype.nextInterval_ = function() {
	var interval = this.interval * 2 + this.getRandomInt_(0, 1000);
	return Math.min(interval, this.maxInterval);
    };

    /**
     * Get a random int in the range of min to max. Used to add jitter to wait times.
     *
     * @param {number} min Lower bounds
     * @param {number} max Upper bounds
     * @private
     */
    RetryHandler.prototype.getRandomInt_ = function(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
    };


    /**
     * Helper class for resumable uploads using XHR/CORS. Can upload any Blob-like item, whether
     * files or in-memory constructs.
     *
     * @example
     * var content = new Blob(["Hello world"], {"type": "text/plain"});
     * var uploader = new MediaUploader({
     *   file: content,
     *   token: accessToken,
     *   onComplete: function(data) { ... }
     *   onError: function(data) { ... }
     * });
     * uploader.upload();
     *
     * @constructor
     * @param {object} options Hash of options
     * @param {string} options.token Access token
     * @param {blob} options.file Blob-like item to upload
     * @param {string} [options.fileId] ID of file if replacing
     * @param {object} [options.params] Additional query parameters
     * @param {string} [options.contentType] Content-type, if overriding the type of the blob.
     * @param {object} [options.metadata] File metadata
     * @param {function} [options.onComplete] Callback for when upload is complete
     * @param {function} [options.onProgress] Callback for status for the in-progress upload
     * @param {function} [options.onError] Callback if upload fails
     */
    var MediaUploader = function(options) {
	var noop = function() {};
	this.file = options.file;
	this.contentType = options.contentType || this.file.type || 'application/octet-stream';
	this.metadata = options.metadata || {
	    'name': this.file.name,
	    'mimeType': this.contentType
	};
	// if options.token omitted, get access_token from existing window.gapi instance, if any : PJB 2017-11-01
	// see https://developers.google.com/api-client-library/javascript/reference/referencedocs
	if (options.token){
	    this.token = options.token;
	} else {
	    try {
		this.token = (window.gapi
			      .auth2
			      .getAuthInstance()
			      .currentUser
			      .get()
			      .getAuthResponse(true)
			      .access_token
			     );
	    } catch(e){
		console.log(e);
		throw new Error("Uploader: missing Google OAuth2 access_token");
	    }
	}
	// end access_token patch -- PJB 2017-11-01
	this.onComplete = options.onComplete || noop;
	this.onProgress = options.onProgress || noop;
	this.onError = options.onError || noop;
	this.offset = options.offset || 0;
	this.chunkSize = options.chunkSize || 0;
	this.retryHandler = new RetryHandler();

	this.url = options.url;
	if (!this.url) {
	    var params = options.params || {};
	    params.uploadType = 'resumable';
	    this.url = this.buildUrl_(options.fileId, params, options.baseUrl);
	}
	// PJB 2018.01.22 Change "update/replace" method from "PUT" to "PATCH"
	//   per https://developers.google.com/drive/v3/reference/files/update
	this.httpMethod = options.fileId ? 'PATCH' : 'POST';
    };

    /**
     * Initiate the upload.
     */
    MediaUploader.prototype.upload = function() {
	var self = this;
	var xhr = new XMLHttpRequest();

	xhr.open(this.httpMethod, this.url, true);
	xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.setRequestHeader('X-Upload-Content-Length', this.file.size);
	xhr.setRequestHeader('X-Upload-Content-Type', this.contentType);

	xhr.onload = function(e) {
	    if (e.target.status < 400) {
		var location = e.target.getResponseHeader('Location');
		this.url = location;
		this.sendFile_();
	    } else {
		this.onUploadError_(e);
	    }
	}.bind(this);
	xhr.onerror = this.onUploadError_.bind(this);
	xhr.send(JSON.stringify(this.metadata));
    };

    /**
     * Send the actual file content.
     *
     * @private
     */
    MediaUploader.prototype.sendFile_ = function() {
	var content = this.file;
	var end = this.file.size;

	if (this.offset || this.chunkSize) {
	    // Only bother to slice the file if we're either resuming or uploading in chunks
	    if (this.chunkSize) {
		end = Math.min(this.offset + this.chunkSize, this.file.size);
	    }
	    content = content.slice(this.offset, end);
	}

	var xhr = new XMLHttpRequest();
	xhr.open('PUT', this.url, true);
	xhr.setRequestHeader('Content-Type', this.contentType);
	xhr.setRequestHeader('Content-Range', "bytes " + this.offset + "-" + (end - 1) + "/" + this.file.size);
	xhr.setRequestHeader('X-Upload-Content-Type', this.file.type);
	if (xhr.upload) {
	    xhr.upload.addEventListener('progress', this.onProgress);
	}
	xhr.onload = this.onContentUploadSuccess_.bind(this);
	xhr.onerror = this.onContentUploadError_.bind(this);
	xhr.send(content);
    };

    /**
     * Query for the state of the file for resumption.
     *
     * @private
     */
    MediaUploader.prototype.resume_ = function() {
	var xhr = new XMLHttpRequest();
	xhr.open('PUT', this.url, true);
	xhr.setRequestHeader('Content-Range', "bytes */" + this.file.size);
	xhr.setRequestHeader('X-Upload-Content-Type', this.file.type);
	if (xhr.upload) {
	    xhr.upload.addEventListener('progress', this.onProgress);
	}
	xhr.onload = this.onContentUploadSuccess_.bind(this);
	xhr.onerror = this.onContentUploadError_.bind(this);
	xhr.send();
    };

    /**
     * Extract the last saved range if available in the request.
     *
     * @param {XMLHttpRequest} xhr Request object
     */
    MediaUploader.prototype.extractRange_ = function(xhr) {
	var range = xhr.getResponseHeader('Range');
	if (range) {
	    this.offset = parseInt(range.match(/\d+/g).pop(), 10) + 1;
	}
    };

    /**
     * Handle successful responses for uploads. Depending on the context,
     * may continue with uploading the next chunk of the file or, if complete,
     * invokes the caller's callback.
     *
     * @private
     * @param {object} e XHR event
     */
    MediaUploader.prototype.onContentUploadSuccess_ = function(e) {
	if (e.target.status == 200 || e.target.status == 201) {
	    this.onComplete(e.target.response);
	} else if (e.target.status == 308) {
	    this.extractRange_(e.target);
	    this.retryHandler.reset();
	    this.sendFile_();
	} else {
	    this.onContentUploadError_(e);
	}
    };

    /**
     * Handles errors for uploads. Either retries or aborts depending
     * on the error.
     *
     * @private
     * @param {object} e XHR event
     */
    MediaUploader.prototype.onContentUploadError_ = function(e) {
	if (e.target.status && e.target.status < 500) {
	    this.onError(e.target.response);
	} else {
	    this.retryHandler.retry(this.resume_.bind(this));
	}
    };

    /**
     * Handles errors for the initial request.
     *
     * @private
     * @param {object} e XHR event
     */
    MediaUploader.prototype.onUploadError_ = function(e) {
	this.onError(e.target.response); // TODO - Retries for initial upload
    };

    /**
     * Construct a query string from a hash/object
     *
     * @private
     * @param {object} [params] Key/value pairs for query string
     * @return {string} query string
     */
    MediaUploader.prototype.buildQuery_ = function(params) {
	params = params || {};
	return Object.keys(params).map(function(key) {
	    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
	}).join('&');
    };

    /**
     * Build the drive upload URL
     *
     * @private
     * @param {string} [id] File ID if replacing
     * @param {object} [params] Query parameters
     * @return {string} URL
     */
    MediaUploader.prototype.buildUrl_ = function(id, params, baseUrl) {
	// modified next line to use v3, not v2 -- PJB, 2017-11-01
	var url = baseUrl || 'https://www.googleapis.com/upload/drive/v3/files/';
	if (id) {
	    url += id;
	}
	var query = this.buildQuery_(params);
	if (query) {
	    url += '?' + query;
	}
	return url;
    };


    return MediaUploader;
    
})();

window.pUploaderForGoogleDrive = function(options){
    "use strict";
    return new Promise(function(resolve, reject){
	options.onComplete = function(r){
	    var response;
	    try {
		response = (typeof(r)==='string')? JSON.parse(r): r;
	    } catch(e){
		response = r;
	    }
	    resolve(response);
	};
	options.onError = function(e){ reject(e); };
	var uploader = new window.UploaderForGoogleDrive(options);
	uploader.upload();
    });
};
