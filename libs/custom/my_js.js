$(document).ready(function() {
  $('a[href^="#"]').on('click', function(e) {
    e.preventDefault();
    var target = $(this.hash);
    if (target.length) {
      $('html, body').stop().animate({
        scrollTop: target.offset().top - 20
      }, 400, 'swing', function() {
        window.location.hash = e.target.hash;
      });
    }
  });
});
