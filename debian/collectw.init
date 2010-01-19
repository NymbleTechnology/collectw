#!/bin/sh

### BEGIN INIT INFO
# Provides:          collectw
# Required-Start:    $local_fs $syslog
# Required-Stop:     $local_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Start daemon at boot time
# Description:       Enable service provided by daemon.
### END INIT INFO

name=collectw

PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

exec=/usr/bin/$name
pidf=/var/run/$name.pid
logf=/var/log/$name.log

[ -f default-collectw ] && { 
    . ./default-collectw
    true
} || {
    [ -f /etc/default/$name ] && . /etc/default/$name
}

[ -x $exec ] || {
    echo "Service executable \"$exec\" unavailable.."
    exit 1;
}

service_status () {
    [ -f $pidf ] && [ -d /proc/$(cat $pidf) ]
    return $?
}

service_start () {
    service_status && {
	echo "$name already started.."
    } || {
	echo "Starting $name.."
	$exec $options 2> $logf &
	echo $! > $pidf
    }
}

service_stop () {
    service_status && {
	echo -n "Stopping $name.."
	kill $(cat $pidf)
	while [ -d /proc/$(cat $pidf) ]; do
	    sleep 1
	    echo -n "."
	done
	echo
	rm -f $pidf
    } || {
	echo "$name already stopped.."
    }
}

case "$1" in
    start)
	service_start
	;;
    stop)
	service_stop
	;;
    restart)
	service_stop && service_start
	;;
    status)
	service_status && echo "Started.." || echo "Stopped.."
	;;
    *)
	echo "Usage: $name {start|stop|restart|status}"
	;;
esac
