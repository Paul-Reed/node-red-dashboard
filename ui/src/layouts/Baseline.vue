<template>
    <v-app class="nrdb-app nrdb-app--baseline">
        <div v-for="siteTemplate in siteTemplates($route.meta.dashboard)" :key="siteTemplate.id" style="display: none">
            Loaded site template '{{ siteTemplate.id }}'
            <component :is="siteTemplate.component" :id="siteTemplate.id" :props="siteTemplate.props" :state="siteTemplate.state" />
        </div>
        <div v-for="pageTemplate in pageTemplates($route.meta.id)" :key="pageTemplate.id" style="display: none">
            Loaded site template '{{ pageTemplate.id }}'
            <component :is="pageTemplate.component" :id="pageTemplate.id" :props="pageTemplate.props" :state="pageTemplate.state" />
        </div>
        <v-app-bar :elevation="1">
            <template #prepend>
                <v-app-bar-nav-icon @click="drawer = !drawer" />
            </template>
            <v-app-bar-title>{{ pageTitle }}</v-app-bar-title>
            <template #append>
                <div id="app-bar-actions" />
            </template>
        </v-app-bar>

        <v-main>
            <v-navigation-drawer v-model="drawer" data-el="nav-drawer">
                <v-list nav>
                    <v-list-item
                        v-for="page in orderedPages" :key="page.id" active-class="v-list-item--active"
                        :disabled="page.disabled || undefined"
                        :prepend-icon="`mdi-${page.icon || 'home'}`"
                        :title="getPageLabel(page)"
                        :to="{name: page.route.name}" link
                        :data-nav="page.id"
                    />
                </v-list>
            </v-navigation-drawer>
            <slot class="nrdb-layout" />
            <div class="nrdb-layout-overlay">
                <!-- Render any widgets with a 'ui' scope, e.g. ui-notification, ui-event, ui-control -->
                <component
                    :is="widget.component"
                    v-for="widget in uiWidgets"
                    :id="widget.id"
                    :key="widget.id"
                    :props="widget.props"
                    :state="widget.state"
                />
            </div>
        </v-main>
    </v-app>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

/**
 * Convert a hex to RGB color
 * @param {String(hex)} hex
 */
function hexToRgb (hex) {
    const bigint = parseInt(hex.replace('#', ''), 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    return [r, g, b]
}

/**
 * Given a hex color code to represent a bg, return an appropriately contrasting text color
 * @param {String(hex)} bg
 */
function getContrast (bg) {
    const bgRgb = hexToRgb(bg)

    // http://www.w3.org/TR/AERT#color-contrast
    const brightness = Math.round(((parseInt(bgRgb[0]) * 299) +
                        (parseInt(bgRgb[1]) * 587) +
                        (parseInt(bgRgb[2]) * 114)) / 1000)

    const textColor = (brightness > 125) ? '#000000' : '#ffffff'
    return textColor
}

export default {
    name: 'BaslineLayout',
    props: {
        pageTitle: {
            type: String,
            default: 'Page Title Here'
        }
    },
    data () {
        return {
            drawer: false
        }
    },
    computed: {
        ...mapState('ui', ['dashboards', 'pages', 'themes', 'pageData', 'widgets']),
        ...mapGetters('ui', ['siteTemplates', 'pageTemplates']),

        theme: function () {
            const page = this.pages[this.$route.meta.id]
            if (page) {
                const theme = this.themes[page?.theme].colors
                return theme
            } else {
                return null
            }
        },
        orderedPages: function () {
            return Object.values(this.pages)
                .filter((p) => {
                    if ('visible' in p && !p.visible) {
                        return false
                    }
                    return true
                })
                .sort((a, b) => a.order - b.order)
        },
        uiWidgets: function () {
            // get widgets scoped to the UI, not a group/page
            const widgets = Object.values(this.widgets).filter(w => {
                return Object.hasOwn(w.props, 'ui') && !!w.props.ui && !w.props.group && !w.props.page
            })
            return widgets
        },
        dashboard: function () {
            const dId = Object.keys(this.dashboards)[0]
            return this.dashboards[dId]
        }
    },
    watch: {
        theme: function () {
            this.updateTheme()
        }
    },
    mounted () {
        this.updateTheme()
    },
    methods: {
        go: function (name) {
            this.$router.push({
                name
            })
        },
        updateTheme () {
            const theme = this.$vuetify.theme.themes.nrdb.colors
            if (this.theme) {
                // convert NR Theming to Vuetify Theming
                theme.surface = this.theme.surface
                // primary bg
                theme.primary = this.theme.primary
                // primary font - auto calculated
                theme['on-primary'] = getContrast(this.theme.primary)
                // UI Background
                theme.background = this.theme.bgPage
                // Group Background
                theme['group-background'] = this.theme.groupBg
                theme['group-outline'] = this.theme.groupOutline
            }
        },
        getPageLabel (page) {
            return page.name + (this.dashboard.showPathInSidebar ? ` (${page.path})` : '')
        }
    }
}
</script>
