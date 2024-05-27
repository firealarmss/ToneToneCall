class Watchdog {
    constructor(timeout, onTimeout) {
        this.timeout = timeout;
        this.onTimeout = onTimeout;
        this.timer = null;
    }

    start() {
        this.clear();
        this.timer = setTimeout(this.onTimeout, this.timeout);
    }

    clear() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}

module.exports = Watchdog;