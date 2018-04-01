/**
 * Pin Form for Pinry
 * Descrip: This is for creation new pins on everything, the bookmarklet, on the
 *          site and even editing pins in some limited situations.
 * Authors: Pinry Contributors
 * Updated: March 3rd, 2013
 * Require: jQuery, Pinry JavaScript Helpers
 */


$(window).load(function() {
    var uploadedImage = false;
    var editedPin = null;
    var RECENT_TAGS_LIMIT = 10;

    // Start Helper Functions
    function getFormData() {
        return {
            submitter: currentUser,
            url: $('#pin-form-image-url').val(),
            description: $('#pin-form-description').val(),
            tags: cleanTags($('#pin-form-tags').val())
        }
    }

    function createPinPreviewFromForm() {
        var context = {pins: [{
                submitter: currentUser,
                image: {thumbnail: {image: $('#pin-form-image-url').val()}},
                description: $('#pin-form-description').val(),
                tags: cleanTags($('#pin-form-tags').val())
            }]},
            html = renderTemplate('#pins-template', context),
            preview = $('#pin-form-image-preview');
        preview.html(html);
        preview.find('.pin').width(240);
        preview.find('.pin').fadeIn(300);
        if (getFormData().url == "")
            preview.find('.image-wrapper').height(255);
        preview.find('.image-wrapper img').fadeIn(300);
        setTimeout(function() {
            if (preview.find('.pin').height() > 305) {
                $('#pin-form .modal-body').animate({
                    'height': preview.find('.pin').height()+25
                }, 300);
            }
        }, 300);
    }

    function dismissModal(modal) {
        modal.modal('hide');
        modal.on('hidden.bs.modal', function() {
            modal.remove();
        });
    }
    // End Helper Functions


    // Start View Functions
    function createPinForm(editPinId) {
        if ($.cookie('pinform_recent_tag')) {
            localStorage.setItem('pinform_recent_tag', $.cookie('pinform_recent_tag'));
            $.cookie('pinform_recent_tag', '', {expire:1, path:'/'});
        }
        $('body').append(renderTemplate('#pin-form-template', {
            recentTags: cleanTags(localStorage.getItem('pinform_recent_tag') || "")
        }));
        var modal = $('#pin-form'),
            formFields = [$('#pin-form-image-url'), $('#pin-form-description'),
            $('#pin-form-tags')],
            pinFromUrl = getUrlParameter('pin-image-url'),
            pinFromDomain = undefined;
        // If editable grab existing data
        if (editPinId) {
            var promise = getPinData(editPinId);
            promise.success(function(data) {
                editedPin = data;
                $('#pin-form-image-url').val(editedPin.image.thumbnail.image);
                $('#pin-form-image-url').parent().hide();
                $('#pin-form-image-upload').parent().hide();
                $('#pin-form-description').val(editedPin.description);
                $('#pin-form-tags').val(editedPin.tags).trigger('change');
                $('#pin-form-trash').show();
                createPinPreviewFromForm();
            });
        } else {
            $('#pin-form-tags').val(tagFilter).trigger('change');
        }
        modal.modal({
            show: true,
            backdrop: 'static'
        });
        // Auto update preview on field changes
        var timer;
        for (var i in formFields) {
            formFields[i].bind('propertychange keyup input paste', function() {
                clearTimeout(timer);
                timer = setTimeout(function() {
                    createPinPreviewFromForm()
                }, 700);
                if (!uploadedImage)
                    $('#pin-form-image-upload').parent().fadeOut(300);
            });
        }
        // Drag and drop upload
        $('#pin-form-image-upload').dropzone({
            url: '/pins/create-image/',
            paramName: 'qqfile',
            parallelUploads: 1,
            uploadMultiple: false,
            maxFiles: 1,
            acceptedFiles: 'image/*',
            success: function(file, resp) {
                $('#pin-form-image-url').parent().fadeOut(300);
                var promise = getImageData(resp.success.id);
                uploadedImage = resp.success.id;
                promise.success(function(image) {
                    $('#pin-form-image-url').val(image.thumbnail.image);
                    createPinPreviewFromForm();
                });
                promise.error(function() {
                    message('Problem uploading image.', 'alert alert-error', -1);
                });
            }
        });
        // If bookmarklet submit
        if (pinFromUrl) {
            $('#pin-form-image-upload').parent().css('display', 'none');
            $('#pin-form-image-url').val(pinFromUrl);
            $('.navbar').css('display', 'none');
            var urlParser = document.createElement('a');
            if (getUrlParameter('referer') != '') {
                urlParser.href = getUrlParameter('referer');
            } else {
                urlParser.href = pinFromUrl;
            }
            pinFromDomain = urlParser.hostname;
            if ($.cookie('pinform_domain_tag-' + pinFromDomain)) {
                localStorage.setItem('pinform_domain_tag-' + pinFromDomain, $.cookie('pinform_domain_tag-' + pinFromDomain));
                $.cookie('pinform_domain_tag-' + pinFromDomain, '', {expire:1, path:'/'});
            }
            $('#pin-form-tags').val(localStorage.getItem('pinform_domain_tag-' + pinFromDomain)).trigger('change');
        }
        if (getUrlParameter('pin-description')) {
            $('#pin-form-description').val(getUrlParameter('pin-description'));
        }

        // Submit pin on post click
        $('#pin-form-submit').click(function(e) {
            e.preventDefault();
            $(this).off('click');
            $(this).addClass('disabled');
            if (editedPin) {
                var apiUrl = '/api/v1/pin/'+editedPin.id+'/?format=json';
                var data = {
                    description: $('#pin-form-description').val(),
                    tags: cleanTags($('#pin-form-tags').val().replace(',', ' ').trim())
                }
                if (editedPin.description == data.description && editedPin.tags.toString() == data.tags.toString()) {
                    tileLayout();
                    dismissModal(modal);
                    editedPin = null;
                } else {
                    var promise = $.ajax({
                        type: "put",
                        url: apiUrl,
                        contentType: 'application/json',
                        data: JSON.stringify(data)
                    });
                    promise.success(function(pin) {
                        pin.editable = true;
                        var renderedPin = renderTemplate('#pins-template', {
                            pins: [
                                pin
                            ]
                        });
                        if ($.cookie('pinform_recent_tag')) {
                            localStorage.setItem('pinform_recent_tag', $.cookie('pinform_recent_tag'));
                            $.cookie('pinform_recent_tag', '', {expire:1, path:'/'});
                        }
                        var recentTags = cleanTags(localStorage.getItem('pinform_recent_tag') || "")
                        data.tags.reverse().forEach(function(tag) { recentTags.unshift(tag); });
                        recentTags = recentTags
                            .filter(function(v, k, self) { return self.indexOf(v) === k && v != ''; })
                            .slice(0, RECENT_TAGS_LIMIT);
                        localStorage.setItem('pinform_recent_tag', recentTags);
                        $('#pins').find('.pin[data-id="'+pin.id+'"]').replaceWith(renderedPin);
                        tileLayout();
                        lightbox();
                        dismissModal(modal);
                        editedPin = null;
                    });
                    promise.error(function() {
                        message('Problem updating image.', 'alert alert-danger', -1);
                    });
                }
            } else {
                var data = {
                    submitter: '/api/v1/user/'+currentUser.id+'/',
                    description: $('#pin-form-description').val(),
                    tags: cleanTags($('#pin-form-tags').val().replace(',', ' ').trim())
                };
                if (uploadedImage) {
                    data.image = '/api/v1/image/'+uploadedImage+'/';
                } else {
                    data.url = $('#pin-form-image-url').val();
                    data.referer = getUrlParameter('referer');
                }
                var promise = postPinData(data);
                promise.success(function(pin) {
                    if (pinFromUrl) {
                        if (data.tags != '') {
                            localStorage.setItem('pinform_domain_tag-' + pinFromDomain, data.tags);
                        } else if (localStorage.getItem('pinform_domain_tag-' + pinFromDomain) != '') {
                            localStorage.removeItem('pinform_domain_tag-' + pinFromDomain, {path:'/'});
                        }
                        var recentTags = cleanTags(localStorage.getItem('pinform_recent_tag') || "");
                        data.tags.reverse().forEach(function(tag) { recentTags.unshift(tag); });
                        recentTags = recentTags
                            .filter(function(v, k, self) { return self.indexOf(v) === k && v != ''; })
                            .slice(0, RECENT_TAGS_LIMIT);
                        localStorage.setItem('pinform_recent_tag', recentTags);
                        return window.close();
                    }
                    pin.editable = true;
                    pin = renderTemplate('#pins-template', {pins: [pin]});
                    $('#pins').prepend(pin);
                    tileLayout();
                    lightbox();
                    dismissModal(modal);
                    uploadedImage = false;
                });
                promise.error(function() {
                    message('Problem saving image.', 'alert alert-danger', -1);
                });
            }
        });
        $('#pin-form-close').click(function() {
            if (pinFromUrl) return window.close();
            tileLayout();
            dismissModal(modal);
        });

        // Delete pin if trash icon clicked
        $('#pin-form-trash').click(function() {
            $(this).off('click');
            var promise = deletePinData(editedPin.id);
            promise.success(function() {
                $('#pins .pin[data-id='+editedPin.id+']').closest('.pin').remove();
                tileLayout();
                dismissModal(modal);
            });
            promise.error(function() {
                message('Problem deleting image.', 'alert alert-danger');
            });
        });
        $('#pin-form .tag.btn').click(function() {
            var tags = cleanTags($('#pin-form-tags').val().replace(',', ' ').trim());
            if (tags.indexOf($(this).text()) != -1) {
                tags.splice(tags.indexOf($(this).text()), 1);
            } else {
                tags.push($(this).text());
            }
            $('#pin-form-tags').val(tags.join(' ')).trigger('change');
        });
        $('#pin-form-tags').change(function() {
            var tags = cleanTags($('#pin-form-tags').val().trim());
            $('#pin-form .tag.btn').removeClass('btn-success').addClass('btn-default');
            $('#pin-form .tag.btn').each(function() {
                if ($.inArray($(this).text(), tags) != -1) {
                    $(this).removeClass('btn-default').addClass('btn-success');
                }
            });
        }).keyup(function() {
            $(this).trigger('change');
        });
        if ($('#pin-form-tags').val() != '') {
            $('#pin-form-tags').trigger('change');
        }
        $(window).on('keydown', function(e){
            if (e.keyCode == 13 && e.ctrlKey) {
                $('#pin-form-submit').click();
            }
        });
        createPinPreviewFromForm();
    }
    // End View Functions


    // Start Init
    window.pinForm = function(editPinId) {
        editPinId = typeof editPinId !== 'undefined' ? editPinId : null;
        createPinForm(editPinId);
    }

    if (getUrlParameter('pin-image-url')) {
        createPinForm();
    }
    // End Init
});
