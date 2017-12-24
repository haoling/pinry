/**
 * Lightbox for Pinry
 * Descrip: A lightbox plugin for pinry so that I don't have to rely on some of
 *          the massive code bases of other lightboxes, this one uses data
 *          fields to acquire the info we need and dynamically loads comments.
 *          It also has a nice parallax view mode where the top scrolls and the
 *          background stays stationary.
 * Authors: Pinry Contributors
 * Updated: Feb 4th, 2016
 * Require: jQuery, Pinry JavaScript Helpers
 */


// Start Helper Functions
function freezeScroll(freeze) {
    freeze = typeof freeze !== 'undefined' ? freeze : true;
    if (freeze) {
        if ($('body').data('scroll-level') == undefined) {
            $('body').data('scroll-level', $(window).scrollTop());
        }
        $('#pins').css({
            'position': 'fixed',
            'margin-top': -$('body').data('scroll-level')
        });
        $(window).scrollTop(0);
        /* disable the global pin-loading scroll handler so we don't
           load pins when scrolling a selected image */
        $(window).off('scroll');
    } else {
        $('#pins').css({
            'position': 'static',
            'margin-top': 0
        });
        $(window).scrollTop($('body').data('scroll-level'));
        $('body').removeData('scroll-level');
        /* enable the pin-loading scroll handler unless we've already
           loaded all pins from the server (in which case an element
           with id 'the-end' exists */
        var theEnd = document.getElementById('the-end');
        if (!theEnd) {
            $(window).scroll(scrollHandler);
        }
    }
}
// End Helper Functions

$(window).load(function() {

    // Start View Functions
    function createPromise(id) {
        var promise = getPinData(id);
        promise.success(function(pin) {
            var title = pin.description;
            if (title.length > 20) {
                title = title.substr(0, 20) + '...';
            }
            document.title = 'Pinry - ' + title;
            createBox(pin);
        });
        return promise;
    }
    function createBox(context) {
        var box = $('.lightbox-background');
        var load = true;
        if (box.attr('data-id') != context.id) {
            var oldBox = box;
            oldBox.fadeOut(200);
            setTimeout(function() {
                oldBox.remove();
            }, 200);

            freezeScroll();
            $('body').append(renderTemplate('#lightbox-template', context));
            box = $('.lightbox-background');
        } else {
            // redraw
            load = false;
            freezeScroll();
        }

        box.css('height', '100%');
        if (window.matchMedia('(min-width:'+context.image.standard.width+'px)').matches) {
            $('.lightbox-image-wrapper').css('height', context.image.standard.height);
        }


        if (load) {
            box.fadeIn(200);
            $('.lightbox-image').load(function() {
                $(this).fadeIn(200);
            });
        }

        if (window.matchMedia('(min-width:'+context.image.standard.width+'px)').matches) {
            $('.lightbox-wrapper').css({
                'width': context.image.standard.width,
                'margin-top': 80,
                'margin-bottom': 80,
                'margin-left': -context.image.standard.width/2
            });
        } else {
            $('.lightbox-wrapper').css({
                'width': '100%',
                'left': 'initial',
                'margin-top': 80,
                'margin-bottom': 80
            });
            $('.lightbox-image').css({
                'width': '100%'
            });
        }
        if ($('.lightbox-wrapper').height()+140 > $(window).height()) {
            $('.lightbox-wrapper').css({
                'margin-top': 10,
                'margin-bottom': 10,
            });
            if ($('.lightbox-wrapper').height() > $(window).height()) {
                $('.lightbox-background').height($('.lightbox-wrapper').height()+20);
            }
        }

        box.click(function(e) {
            if ($(e.target).is('a')) return true;
            if (location.pathname.match(/\/([0-9]+)\/$/) && RegExp.$1 == pinFilter) {
                var url = location.origin
                  + location.pathname.replace(/\/[0-9]+\/$/, '/')
                  + location.search;
                history.pushState(null, null, url);
                pinFilter = undefined;
            }
            document.title = 'Pinry';
            $(this).fadeOut(200);
            setTimeout(function() {
                box.remove();
            }, 200);
            freezeScroll(false);
        });
    }
    // End View Functions


    // Start Global Init Function
    window.lightbox = function() {
        var links = $('body').find('.lightbox');
        if (pinFilter) {
            var promise = createPromise(pinFilter);
            promise.error(function() {
                message('Problem problem fetching pin data.', 'alert alert-danger');
            });
        }
        return links.each(function() {
            $(this).off('click');
            $(this).click(function(e) {
                e.preventDefault();
                var id = $(this).data('id');
                var promise = createPromise(id);
                promise.success(function() {
                    var url = location.origin
                      + location.pathname.replace(/\/$/, '') + '/' + id + '/'
                      + location.search;
                    history.pushState({ pin:id }, null, url);
                    pinFilter = id;
                });
                promise.error(function() {
                    message('Problem problem fetching pin data.', 'alert alert-danger');
                });
            });
        });
    }

    window.onpopstate = function(e) {
        if (e.state && e.state.pin) {
            var promise = createPromise(e.state.pin);
            promise.success(function() {
                pinFilter = e.state.pin;
            });
            promise.error(function() {
                message('Problem problem fetching pin data.', 'alert alert-danger');
            });
        } else {
            $('.lightbox-background').trigger('click');
            pinFilter = undefined;
        }
    }

    // End Global Init Function
});
