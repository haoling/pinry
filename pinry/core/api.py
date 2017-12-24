from django.core.exceptions import ObjectDoesNotExist
from tastypie import fields
from tastypie.authorization import DjangoAuthorization
from tastypie.constants import ALL, ALL_WITH_RELATIONS
from tastypie.exceptions import Unauthorized
from tastypie.resources import ModelResource
from django_images.models import Thumbnail

from django.db.models import Q
from .models import Pin, Image
from ..users.models import User


class PinryAuthorization(DjangoAuthorization):
    """
    Pinry-specific Authorization backend with object-level permission checking.
    """
    def update_detail(self, object_list, bundle):
        klass = self.base_checks(bundle.request, bundle.obj.__class__)

        if klass is False:
            raise Unauthorized("You are not allowed to access that resource.")

        permission = '%s.change_%s' % (klass._meta.app_label, klass._meta.model_name)

        if not bundle.request.user.has_perm(permission, bundle.obj):
            raise Unauthorized("You are not allowed to access that resource.")

        return True

    def delete_detail(self, object_list, bundle):
        klass = self.base_checks(bundle.request, bundle.obj.__class__)

        if klass is False:
            raise Unauthorized("You are not allowed to access that resource.")

        permission = '%s.delete_%s' % (klass._meta.app_label, klass._meta.model_name)

        if not bundle.request.user.has_perm(permission, bundle.obj):
            raise Unauthorized("You are not allowed to access that resource.")

        return True


class UserResource(ModelResource):
    gravatar = fields.CharField(readonly=True)

    def dehydrate_gravatar(self, bundle):
        return bundle.obj.gravatar

    class Meta:
        list_allowed_methods = ['get']
        filtering = {
            'username': ALL
        }
        queryset = User.objects.all()
        resource_name = 'user'
        fields = ['username']
        include_resource_uri = False


def filter_generator_for(size):
    def wrapped_func(bundle, **kwargs):
        if hasattr(bundle.obj, '_prefetched_objects_cache') and 'thumbnail' in bundle.obj._prefetched_objects_cache:
            for thumbnail in bundle.obj._prefetched_objects_cache['thumbnail']:
                if thumbnail.size == size:
                    return thumbnail
            raise ObjectDoesNotExist()
        else:
            return bundle.obj.get_by_size(size)
    return wrapped_func


class ThumbnailResource(ModelResource):
    class Meta:
        list_allowed_methods = ['get']
        fields = ['image', 'width', 'height']
        queryset = Thumbnail.objects.all()
        resource_name = 'thumbnail'
        include_resource_uri = False


class ImageResource(ModelResource):
    standard = fields.ToOneField(ThumbnailResource, full=True,
                                 attribute=lambda bundle: filter_generator_for('standard')(bundle))
    thumbnail = fields.ToOneField(ThumbnailResource, full=True,
                                  attribute=lambda bundle: filter_generator_for('thumbnail')(bundle))
    square = fields.ToOneField(ThumbnailResource, full=True,
                               attribute=lambda bundle: filter_generator_for('square')(bundle))

    class Meta:
        fields = ['image', 'width', 'height']
        include_resource_uri = False
        resource_name = 'image'
        queryset = Image.objects.all()
        authorization = DjangoAuthorization()


class PinResource(ModelResource):
    submitter = fields.ToOneField(UserResource, 'submitter', full=True)
    image = fields.ToOneField(ImageResource, 'image', full=True)
    tags = fields.ListField()
    domain = fields.CharField(attribute='domain', readonly=True, null=True)

    def hydrate_image(self, bundle):
        url = bundle.data.get('url', None)
        if url:
            image = Image.objects.create_for_url(url, bundle.data.get('referer', None))
            bundle.data['image'] = '/api/v1/image/{}/'.format(image.pk)
        return bundle

    def hydrate(self, bundle):
        """Run some early/generic processing

        Make sure that user is authorized to create Pins first, before
        we hydrate the Image resource, creating the Image object in process
        """
        submitter = bundle.data.get('submitter', None)
        if not submitter:
            bundle.data['submitter'] = '/api/v1/user/{}/'.format(bundle.request.user.pk)
        else:
            if not '/api/v1/user/{}/'.format(bundle.request.user.pk) == submitter:
                raise Unauthorized("You are not authorized to create Pins for other users")
        return bundle

    def dehydrate_tags(self, bundle):
        return map(str, bundle.obj.tags.all())

    def build_filters(self, filters=None):
        if 'domain' in filters:
            domain_filter = filters.pop('domain')

        orm_filters = super(PinResource, self).build_filters(filters)

        if filters:
            if 'tag' in filters:
                orm_filters['tags__name__in'] = filters['tag'].split(',')

        return orm_filters

    def apply_filters(self, request, applicable_filters):
        filtered = super(PinResource, self).apply_filters(request, applicable_filters)

        if applicable_filters.has_key('tags__name__in'):
            if 'private' not in (tag.lower() for tag in applicable_filters['tags__name__in']):
                filtered = filtered.filter(Q(submitter=request.user.pk) | ~Q(tags__name__iexact='private'))
        else:
            filtered = filtered.exclude(tags__name__iexact='private')

        if request.GET.get('search', None):
            filtered = filtered.filter(self.search_filter(request.GET.get('search')))

        if request.GET.get('domain', None):
            domain = request.GET.get('domain', None)
            filtered = filtered.filter(
                Q(url__startswith='http://'+domain+'/')
                | Q(url__startswith='https://'+domain+'/')
            )

        return filtered

    def search_filter(self, keywords):
        q = None
        t = None
        n = False
        o = None
        word = u''
        for c in keywords + u' ':
            if c == u' ':
                if word == u'':
                    continue
                if t == u'tag':
                    ids = Pin.objects.all().filter(tags__name__icontains=word).values_list('id')
                    r = Q(id__in=ids)
                    t = None
                else:
                    if word.lower() == u'or':
                        o = u'or'
                        word = u''
                        continue

                    r = Q(description__icontains=word)
                if n:
                    r = ~r
                if o == u'or':
                    q = q | r if q else r
                    o = u''
                else:
                    q = q & r if q else r
                word = u''
                continue
            if c == u':' and word == u'tag':
                t = u'tag'
                word = u''
                continue
            if c == u':' and word == u'not':
                n = True
                word = u''
                continue
            word += c
        return q

    def save_m2m(self, bundle):
        tags = bundle.data.get('tags', None)
        if tags:
            bundle.obj.tags.set(*tags)
        return super(PinResource, self).save_m2m(bundle)

    class Meta:
        fields = ['id', 'url', 'origin', 'description']
        ordering = ['id']
        filtering = {
            'submitter': ALL_WITH_RELATIONS
        }
        queryset = Pin.objects.all().select_related('submitter', 'image'). \
            prefetch_related('image__thumbnail_set', 'tags')
        resource_name = 'pin'
        include_resource_uri = False
        always_return_data = True
        authorization = PinryAuthorization()
