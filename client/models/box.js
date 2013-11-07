define([
    'hr/hr',
    'vendors/socket.io',
    'core/api',
    'models/file',
    'models/shell',
    'models/user'
], function (hr, io, api, File, Shell, User) {
    var logging = hr.Logger.addNamespace("codebox");

    var Codebox = hr.Model.extend({
        defaults: {
            'status': null,
            'name': null,
            'uptime': 0,
            'mtime': 0,
            'collaborators': 0,
        },

        /*
         *  Client interface to a codebox
         */
        initialize: function() {
            Codebox.__super__.initialize.apply(this, arguments);

            this.baseUrl = this.options.baseUrl || "";
            this.state = false;

            this.user = null;

            // Root file
            this.root = new File({
                'codebox': this
            });
            this.root.getByPath("/");

            // Connect to events
            this.listenEvents();

            return this;
        },

        /*
         *  Subscribe to events from codebox using socket.io
         */
        listenEvents: function() {
            var that = this;

            this.socket("events").then(function(socket) {
                socket.on('event', function(data) {
                    var eventName = "box:"+data.event.replace(/\./g, ":");
                    that.trigger(eventName, data);
                });
                socket.on('connect', function(data) {
                    that.setStatus(true);
                });
                socket.on('connect_failed', function(data) {
                    that.setStatus(false);
                });
                socket.on('reconnect', function(data) {
                    that.setStatus(true);
                });
                socket.on('reconnect_failed', function(data) {
                    that.setStatus(true);
                });
                socket.on('error', function(data) {
                    that.setStatus(false);
                });
                socket.on('disconnect', function(data) {
                    that.setStatus(false);
                });
            });
        },

        /*
         *  Set codebox status (working or not)
         *  
         *  @status : boolean for the status
         */
        setStatus: function(state) {
            this.state = state;
            logging.log("status ", this.state);
            this.trigger("status", state);
        },

        /*
         *  Socket for the connexion
         *
         *  @namespace : namespace for the socket
         *  @forceCreate : force creation of a new socket
         */
        socket: function(namespace, forceCreate) {
            if (this.baseUrl == null) {
                return Q.reject(new Error("Need a 'baseUrl'"));
            }
            var socket = io.connect([window.location.protocol, '//', window.location.host].join('')+"/"+namespace, {
                'force new connection': forceCreate
            });

            return Q(socket);
        },

        /*
         *  Join the box
         */
        auth: function(authInfo, user) {
            var that = this;

            this.user = user || new User();

            return api.rpc("/auth/join", authInfo).then(function(info) {
                that.user.set(info);
                return Q(info);
            });
        },

        /*
         *  Get box status
         */
        status: function() {
            var that = this;
            return api.rpc("/box/status").then(function(data) {
                that.set(data);
                return Q(data);
            });
        },

        /*
         *  Get list of collaborators
         */
        collaborators: function() {
            return api.rpc("/users/list");
        },

        /*
         *  Get git status
         */
        gitStatus: function() {
            return api.rpc("/git/status");
        },

        /*
         *  Get git changes
         */
        changes: function() {
            return api.rpc("/git/diff_working");
        },

        /*
         *  Get commits chages
         */
        commitsPending: function() {
            return api.rpc("/git/commits_pending");
        },

        /*
         *  Search files
         */
        searchFiles: function(q) {
            return api.rpc("/search/files", {
                "query": q
            });
        },

        /*
         *  Commit to the git workspace
         */
        commit: function(args) {
            args = _.extend(args || {});
            return api.rpc("/git/commit", args);
        },

        /*
         *  Sync (pull & push) the git workspace
         */
        sync: function(args) {
            args = _.extend(args || {}, {});
            return api.rpc("/git/sync", args);
        },

        /*
         *  Open a shell
         */
        openShell: function(args) {
            args = args || {};
            args.codebox = this;
            return new Shell(args);
        },

        /*
         *  Return an http proxy url
         */
        proxyUrl: function(url) {
            return this.baseUrl+"/proxy/"+encodeURIComponent(url);
        }
    });
    

    return Codebox;
});