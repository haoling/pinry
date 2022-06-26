'''
Django middleware for HTTP authentication.

Copyright (c) 2007, Accense Technology, Inc.

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer. 
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution. 
  * Neither the name of the Accense Technology nor the names of its
    contributors may be used to endorse or promote products derived from
    this software without specific prior written permission. 

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
'''

from django.contrib.auth.models import User, AnonymousUser
from django.http import HttpResponse
import base64

# Written by sgk.

# This code depends on the implementation internals of the Django builtin
# 'django.contrib.auth.middleware.AuthenticationMiddleware' authentication
# middleware, specifically the 'request._cached_user' member.

class ByHttpServerMiddleware(object):
  '''
  Reflect the authentication result by HTTP server which hosts Django.

  This middleware must be placed in the 'settings.py' MIDDLEWARE_CLASSES
  definition before the above Django builtin 'AuthenticationMiddleware'.
  You can use the ordinaly '@login_required' decorator to restrict views
  to authenticated users. Set the 'settings.py' LOGIN_URL definition
  appropriately if required.
  '''

  def process_request(self, request):
    if hasattr(request, '_cached_user'):
      return None
    try:
      username = request.META['REMOTE_USER']
      user = User.objects.get(username=username)
    except (KeyError, User.DoesNotExist):
      # Fallback to other authentication middleware.
      return None
    request._cached_user = user
    return None


class Middleware(object):
  '''
  Django implementation of the HTTP basic authentication.

  This middleware must be placed in the 'settings.py' MIDDLEWARE_CLASSES
  definition before the above Django builtin 'AuthenticationMiddleware'.
  Set the 'settings.py' LOGIN_URL definition appropriately if required.

  To show the browser generated login dialog to user, you have to use the
  following '@http_login_required(realm=realm)' decorator instead of the
  ordinaly '@login_required' decorator.
  '''
  def process_request(self, request):
    if hasattr(request, '_cached_user'):
      return None
    try:
      (method, encoded) = request.META['HTTP_AUTHORIZATION'].split()
      if method.lower() != 'basic':
	return None
      (username, password) = base64.b64decode(encoded).split(':')
      user = User.objects.get(username=username, is_active=True)
      if not user.check_password(password):
	user = AnonymousUser()
    except (KeyError, TypeError, User.DoesNotExist):
      # Fallback to other authentication middleware.
      return None
    request._cached_user = user
    return None


def http_login_required(realm=None):
  '''
  Decorator factory to restrict views to authenticated user and show the
  browser generated login dialog if the user is not authenticated.

  This is the function that returns a decorator. To use the decorator,
  use '@http_login_required()' or '@http_login_required(realm='...')'.
  '''
  def decorator(func):
    def handler(request, *args, **kw):
      if request.user.is_authenticated():
	return func(request, *args, **kw)
      response = HttpResponse(status=401)
      response['WWW-Authenticate'] = 'Basic realm="%s"' % (realm or 'Django')
      return response
    return handler
  return decorator
