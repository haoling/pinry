from django.conf.urls import include, url
from django.views.generic import TemplateView

from tastypie.api import Api

from .api import ImageResource, ThumbnailResource, PinResource, UserResource, TagResource
from .views import CreateImage, FullImage


v1_api = Api(api_name='v1')
v1_api.register(ImageResource())
v1_api.register(ThumbnailResource())
v1_api.register(PinResource())
v1_api.register(UserResource())
v1_api.register(TagResource())

urlpatterns = [
    url(r'^api/', include(v1_api.urls, namespace='api')),

    url(r'^pins/pin-form/$', TemplateView.as_view(template_name='core/pin_form.html'),
        name='pin-form'),
    url(r'^pins/create-image/$', CreateImage.as_view(), name='create-image'),

    url(r'^pins/tag/(?P<tag>(\w|-)+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='tag-pins'),
    url(r'^pins/tag/(?P<tag>(\w|-)+)/(?P<pin>[0-9]+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='tag-pins'),
    url(r'^pins/user/(?P<user>(\w|-)+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='user-pins'),
    url(r'^pins/domain/(?P<domain>(\w|-|\.)+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='domain-pins'),
    url(r'^pins/domain/(?P<domain>(\w|-|\.)+)/(?P<pin>[0-9]+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='domain-pins'),
    url(r'^(?P<pin>[0-9]+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='recent-pins'),
    url(r'^pin/(?P<pin>[0-9]+)/$', TemplateView.as_view(template_name='core/pins.html'),
        name='single-pin'),
    url(r'^i/(?P<pin>[0-9]+)\.(jpg|png|gif)$', FullImage.as_view(), name='full-image'),
    url(r'^tags/?$', TemplateView.as_view(template_name='core/tags.html'), name='recent-tags'),
    url(r'^$', TemplateView.as_view(template_name='core/pins.html'),
        name='recent-pins'),
]
