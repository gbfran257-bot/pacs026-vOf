window.config = {
  routerBasename: '/',
  extensions: [],
  modes: [],
  showStudyList: true,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: false,
  strictZSpacingForVolumeViewport: true,

  whiteLabeling: {
    createLogoComponentFn: function (React) {
      return React.createElement(
        'div',
        {
          className: 'pacs-logo',
          style: {
          display: 'flex',
          alignItems: 'center',
          padding: '4px 6px',
          maxWidth: '100%',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          },
        },
        React.createElement('img', {
          src: '/assets/ultimo-logo.png',
          alt: 'Logo',
          style: {
            height: 'clamp(22px, 6vw, 40px)',
            marginRight: '8px',
            flexShrink: 0,
          },
        }),
        React.createElement(
          'span',
          {
            className: 'pacs-logo-text',
            style: {
              fontSize: 'clamp(11px, 3vw, 18px)',
              fontWeight: '600',
              color: '#24305D',
              whiteSpace: 'nowrap',
            },
          },
          'Sistema PACS'
        )
      );
    },
  },

  defaultDataSourceName: 'dcm4chee',

  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dcm4chee',
      configuration: {
        friendlyName: 'DCM4CHEE PACS',
        name: 'dcm4chee',
        wadoUriRoot: '/dcm4chee-arc/aets/DCM4CHEE/wado',
        qidoRoot: '/dcm4chee-arc/aets/DCM4CHEE/rs',
        wadoRoot: '/dcm4chee-arc/aets/DCM4CHEE/rs',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
};
