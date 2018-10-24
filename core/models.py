import requests
import os

from io import BytesIO

from urlparse import urlparse
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.db import models, transaction
from django.dispatch import receiver

from django_images.models import Image as BaseImage, Thumbnail
from taggit.managers import TaggableManager

from users.models import User


class ImageManager(models.Manager):
    _default_ua = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 5.1) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/48.0.2564.82 Safari/537.36',
    }

    # FIXME: Move this into an asynchronous task
    def create_for_url(self, url, referer=None):
        file_name = url.split("/")[-1].split('#')[0].split('?')[0]
        buf = BytesIO()
        headers = dict(self._default_ua)
        if referer is not None:
            headers["Referer"] = referer
            response = requests.get(url, headers=headers)
            if (response.status_code != 200):
                print('status_code: {}, retry without referer'.format(response.status_code))
                response = requests.get(url)
        else:
            response = requests.get(url)
        buf.write(response.content)
        obj = InMemoryUploadedFile(buf, 'image', file_name,
                                   None, buf.tell(), None)
        # create the image and its thumbnails in one transaction, removing
        # a chance of getting Database into a inconsistent state when we
        # try to create thumbnails one by one later
        image = self.create(image=obj)
        for size in settings.IMAGE_SIZES.keys():
            Thumbnail.objects.get_or_create_at_size(image.pk, size)
        return image


class Image(BaseImage):
    objects = ImageManager()

    class Meta:
        proxy = True

    def get_extension(self):
        return os.path.splitext(self.image.name)[1][1:]

    extension = property(get_extension)


class Pin(models.Model):
    submitter = models.ForeignKey(User)
    url = models.URLField(null=True)
    origin = models.URLField(null=True)
    referer = models.URLField(null=True)
    description = models.TextField(blank=True, null=True)
    image = models.ForeignKey(Image, related_name='pin')
    published = models.DateTimeField(auto_now_add=True)
    tags = TaggableManager()

    def __unicode__(self):
        return '%s - %s' % (self.submitter, self.published)

    def get_domain(self):
        if self.url:
            u = urlparse(self.url)
            return u.hostname
        return None

    domain = property(get_domain)

@receiver(models.signals.post_delete, sender=Pin)
def delete_pin_images(sender, instance, **kwargs):
    instance.image.delete()
