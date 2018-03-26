$(document).ready(function() {
    window.message = function(text, classes, timeout) {
        classes = typeof classes !== 'undefined' ? classes : 'alert';
        messageHtml = renderTemplate('#messages-template', {
            text: text,
            classes: classes
        });
        $('#messages').append(messageHtml);
        if (timeout == undefined) timeout = 3000;
        if (timeout != -1) {
            $('#messages li').each(function() {
                $(this).delay(timeout).fadeOut(300);
                var messageDelayed = $(this);
                setTimeout(function() {
                    messageDelayed.remove();
                }, timeout + 300);
            });
        }
    }

    if (errors) {
        for (var i in errors) {
            message(errors[i].text, errors[i].tags);
        }
    }
});
