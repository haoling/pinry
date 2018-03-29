from django.http import HttpResponseRedirect
from django.conf import settings
from django.core.urlresolvers import reverse
from django.views.generic import CreateView, RedirectView
from django_images.models import Image

from braces.views import JSONResponseMixin, LoginRequiredMixin
from django_images.models import Thumbnail

from .forms import ImageForm
from .models import Pin, Image


class CreateImage(JSONResponseMixin, LoginRequiredMixin, CreateView):
    template_name = None  # JavaScript-only view
    model = Image
    form_class = ImageForm

    def get(self, request, *args, **kwargs):
        if not request.is_ajax():
            return HttpResponseRedirect(reverse('core:recent-pins'))
        return super(CreateImage, self).get(request, *args, **kwargs)

    def form_valid(self, form):
        image = form.save()
        for size in settings.IMAGE_SIZES:
            Thumbnail.objects.get_or_create_at_size(image.pk, size)
        return self.render_json_response({
            'success': {
                'id': image.id
            }
        })

    def form_invalid(self, form):
        return self.render_json_response({'error': form.errors})

class FullImage(RedirectView):
    permanent = False
    def get_redirect_url(self, *args, **kwargs):
        pin = Pin.objects.prefetch_related('image', 'image__thumbnail_set').get(id=kwargs.get('pin'))
        return '/media/' + pin.image.image.name
